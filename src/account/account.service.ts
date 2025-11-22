// src/accounts/account.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    Inject,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, AccountContentDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
    Account,
    SystemRole,
    AccountRole,
    ProductStatus,
    AccountActivityType,
    FileUsage,
    Language,
    Prisma, BuyAdStatus,
} from '@prisma/client';
import { FileService } from "../file/file.service";

@Injectable()
export class AccountService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private fileService: FileService
    ) {}

    private readonly CACHE_TTL = 5 * 60 * 1000;
    private readonly MAX_ACCOUNTS_PER_USER = 10;

    // ==================== متدهای اصلی چندزبانه ====================

    async create(user_id: string, createAccountDto: CreateAccountDto, language: Language = Language.fa) {
        return this.createAccount(user_id, createAccountDto, language);
    }

    async findAllByUser(user_id: string, language: Language = Language.fa) {
        return this.findUserAccounts(user_id, language);
    }

    async findOne(id: string, user_id: string, userRole: SystemRole, language: Language = Language.fa) {
        return this.findAccountById(id, user_id, userRole, language);
    }

    async update(
        id: string,
        user_id: string,
        userRole: SystemRole,
        updateAccountDto: UpdateAccountDto,
        language: Language = Language.fa
    ) {
        return this.updateAccount(id, user_id, userRole, updateAccountDto, language);
    }

    // ==================== پیاده‌سازی متدها ====================

    private async createAccount(user_id: string, createAccountDto: CreateAccountDto, language: Language) {
        // بررسی تعداد اکانت‌های کاربر
        const userAccountsCount = await this.prisma.accountUser.count({
            where: {
                user_id: user_id,
                account: { is_active: true },
            },
        });

        if (userAccountsCount >= this.MAX_ACCOUNTS_PER_USER) {
            throw new ConflictException(
                `شما نمی‌توانید بیش از ${this.MAX_ACCOUNTS_PER_USER} کسب‌وکار فعال داشته باشید`,
            );
        }

        // 🔥 اعتبارسنجی لوکیشن‌ها
        await this.validateLocations(createAccountDto);

        // ایجاد اکانت با محتوای چندزبانه
        const account = await this.prisma.account.create({
            data: {
                activity_type: createAccountDto.activity_type,
                industryId: createAccountDto.industryId,
                business_tags: createAccountDto.business_tags || [],

                // 🔥 سیستم لوکیشن جدید
                location_level_1_id: createAccountDto.location_level_1_id,
                location_level_2_id: createAccountDto.location_level_2_id,
                location_level_3_id: createAccountDto.location_level_3_id,
                location_level_4_id: createAccountDto.location_level_4_id,

                public_phone: createAccountDto.public_phone,
                postal_code: createAccountDto.postal_code,
                shaba_code: createAccountDto.shaba_code,
                is_company: createAccountDto.is_company || false,
                company_register_code: createAccountDto.company_register_code,
                human_resource_count: createAccountDto.human_resource_count,

                is_active: true,
                confirmed: false,

                // 🔥 ایجاد محتوای چندزبانه
                contents: {
                    create: createAccountDto.contents.map(content => ({
                        language: content.language,
                        name: content.name,
                        description: content.description,
                        profile_description: content.profile_description,
                        related_activity_history: content.related_activity_history,
                        auto_translated: content.auto_translated,
                    }))
                }
            },
            include: this.getAccountInclude(language),
        });

        // ایجاد رابطه کاربر با اکانت به عنوان مالک
        await this.prisma.accountUser.create({
            data: {
                user_id: user_id,
                account_id: account.id,
                account_role: AccountRole.OWNER,
            },
        });

        // پاک کردن کش
        await this.clearUserAccountsCache(user_id);

        return this.mergeMultilingualContent(account, language);
    }
// ==================== متدهای کمکی مدیریت فایل ====================

    private formatAccountFiles(files: any[]): any[] {
        if (!files || files.length === 0) {
            return [];
        }

        return files.map(file => ({
            id: file.id,
            file_path: file.file_path,
            thumbnail_path: file.thumbnail_path,
            file_usage: file.file_usage,
            description: file.description,
            created_at: file.created_at,
            // 🔗 اضافه کردن URLهای دانلود
            download_url: `/files/download/${file.id}`,
            thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
            stream_url: `/files/stream/${file.id}`,
        }));
    }

    private extractLogoFromFileId(files: any[]): any {
        if (!files || files.length === 0) {
            return null;
        }

        const logoFile = files.find(f => f.file_usage === FileUsage.LOGO);
        if (!logoFile) {
            return null;
        }
        return logoFile.id
        /*return {
            id: logoFile.id,
            file_path: logoFile.file_path,
            thumbnail_path: logoFile.thumbnail_path,
            file_usage: logoFile.file_usage,
            description: logoFile.description,
            created_at: logoFile.created_at,
            download_url: `/files/download/${logoFile.id}`,
            thumbnail_url: logoFile.thumbnail_path ? `/files/thumbnail/${logoFile.id}` : null,
            stream_url: `/files/stream/${logoFile.id}`,
        };*/
    }
    private async findUserAccounts(user_id: string, language: Language) {
        const cacheKey = `user_accounts:${user_id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account_users = await this.prisma.accountUser.findMany({
            where: {
                user_id: user_id,
                account: { is_active: true },
            },
            include: {
                account: {
                    include: {
                        ...this.getAccountInclude(language),
                        _count: {
                            select: {
                                products: {
                                    where: {
                                        status: ProductStatus.APPROVED,
                                        confirmed: true
                                    },
                                },
                                buy_ads: {
                                    where: {
                                        status: BuyAdStatus.FULFILLED
                                    }
                                },
                                reviews: { where: { confirmed: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const accounts = account_users.map((au) => ({
            ...this.mergeMultilingualContent(au.account, language),
            userRole: au.account_role,
            // ✅ اضافه کردن همه فایل‌های اکانت
            files: this.formatAccountFiles(au.account.files),
            // ✅ اضافه کردن لوگو جداگانه
            logo: this.extractLogoFromFileId(au.account.files),
        }));

        await this.cacheManager.set(cacheKey, accounts, this.CACHE_TTL);
        return accounts;
    }

    private async findAccountById(id: string, user_id: string, userRole: SystemRole, language: Language) {
        const cacheKey = `account:${id}:${language}`;

        // بررسی دسترسی
        if (!(await this.validateAccountAccess(id, user_id, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account = await this.prisma.account.findUnique({
            where: { id },
            include: {
                ...this.getDetailedAccountInclude(language),
                account_users: {
                    where: { user_id: user_id },
                    select: { account_role: true },
                },
                _count: {
                    select: {
                        products: {
                            where: {
                                status: ProductStatus.APPROVED,
                                confirmed: true
                            },
                        },
                        buy_ads: {
                            where: {
                                status: BuyAdStatus.FULFILLED
                            }
                        },
                    },
                },
            },
        });

        if (!account) {
            throw new NotFoundException('کسب‌وکار پیدا نشد');
        }

        const result = {
            ...this.mergeMultilingualContent(account, language),
            userRole: account.account_users[0]?.account_role,
            // ✅ اضافه کردن فایل‌ها و لوگو
            files: this.formatAccountFiles((account as any).files || []),
            logo: this.extractLogoFromFileId((account as any)),
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    private async updateAccount(
        id: string,
        user_id: string,
        userRole: SystemRole,
        updateAccountDto: UpdateAccountDto,
        language: Language
    ) {
        if (!(await this.validateAccountAccess(id, user_id, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        // 🔥 اعتبارسنجی لوکیشن‌های جدید
        await this.validateLocations(updateAccountDto);

        // 🔥 آماده‌سازی داده برای آپدیت
        const updateData: any = {
            activity_type: updateAccountDto.activity_type,
            industryId: updateAccountDto.industryId,
            business_tags: updateAccountDto.business_tags,

            // 🔥 سیستم لوکیشن جدید
            location_level_1_id: updateAccountDto.location_level_1_id || undefined,
            location_level_2_id: updateAccountDto.location_level_2_id || undefined,
            location_level_3_id: updateAccountDto.location_level_3_id || undefined,
            location_level_4_id: updateAccountDto.location_level_4_id || undefined,

            public_phone: updateAccountDto.public_phone || undefined,
            postal_code: updateAccountDto.postal_code || undefined,
            shaba_code: updateAccountDto.shaba_code || undefined,
            is_company: updateAccountDto.is_company,
            company_register_code: updateAccountDto.company_register_code || undefined,
            human_resource_count: updateAccountDto.human_resource_count || undefined,
        };

        // 🔥 حذف فیلدهای undefined
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        let finalAccount;
        let wasAutoConfirmed = false;

        if (updateAccountDto.contents && updateAccountDto.contents.length > 0) {
            // آپدیت با محتوای چندزبانه
            const updatedAccount = await this.prisma.account.update({
                where: { id },
                data: updateData,
            });

            await Promise.all(
                updateAccountDto.contents.map(content =>
                    this.prisma.accountContent.upsert({
                        where: {
                            account_id_language: {
                                account_id: id,
                                language: content.language
                            }
                        },
                        create: {
                            account_id: id,
                            language: content.language,
                            name: content.name,
                            description: content.description,
                            profile_description: content.profile_description,
                            related_activity_history: content.related_activity_history,
                            auto_translated: content.auto_translated,
                        },
                        update: {
                            name: content.name,
                            description: content.description,
                            profile_description: content.profile_description,
                            related_activity_history: content.related_activity_history,
                            auto_translated: content.auto_translated,
                        }
                    })
                )
            );

            // 🔥 حالا اکانت رو fetch می‌کنیم و شرایط تایید رو بررسی می‌کنیم
            finalAccount = await this.prisma.account.findUnique({
                where: { id },
                include: {
                    ...this.getAccountInclude(language),
                    contents: {
                        where: { language }
                    }
                },
            });

            // 🔥 بررسی تایید خودکار بعد از fetch
            if (finalAccount && !finalAccount.confirmed) {
                const shouldAutoConfirm = this.checkAutoConfirmationConditions(finalAccount);
                if (shouldAutoConfirm) {
                    // آپدیت برای تایید اکانت
                    await this.prisma.account.update({
                        where: { id },
                        data: {
                            confirmed: true,
                            confirmed_at: new Date()
                        }
                    });

                    wasAutoConfirmed = true;
                    finalAccount.confirmed = true;
                    finalAccount.confirmed_at = new Date();
                }
            }

        } else {
            // آپدیت ساده بدون محتوای چندزبانه
            finalAccount = await this.prisma.account.update({
                where: { id },
                data: updateData,
                include: this.getAccountInclude(language),
            });

            // 🔥 بررسی تایید خودکار برای آپدیت ساده
            if (!finalAccount.confirmed) {
                const shouldAutoConfirm = this.checkAutoConfirmationConditions(finalAccount);
                if (shouldAutoConfirm) {
                    // آپدیت برای تایید اکانت
                    const confirmedAccount = await this.prisma.account.update({
                        where: { id },
                        data: {
                            confirmed: true,
                            confirmed_at: new Date()
                        },
                        include: this.getAccountInclude(language),
                    });

                    wasAutoConfirmed = true;
                    finalAccount = confirmedAccount;
                }
            }
        }

        // 🔥 ارسال نوتیفیکیشن در صورت تایید خودکار
        if (wasAutoConfirmed) {
            //await this.sendAutoConfirmationNotification(id, user_id, language);
        }

        await this.clearAccountCache(id, user_id, language);
        return this.mergeMultilingualContent(finalAccount, language);
    }
    private checkAutoConfirmationConditions(account: any): boolean {
        // بررسی فیلدهای اجباری
        const hasRequiredFields =
            account.activity_type &&
            account.industryId &&
            account.location_level_1_id &&
            account.location_level_2_id &&
            account.location_level_3_id;

        // بررسی نام کسب‌وکار
        const hasValidName =
            account.contents?.[0]?.name &&
            account.contents[0].name.trim().length >= 2;

        return hasRequiredFields && hasValidName;
    }
    // 🔥 متدهای مدیریت محتوای چندزبانه
    async createAccountContent(accountId: string, contentDto: AccountContentDto) {
        const account = await this.prisma.account.findUnique({
            where: { id: accountId }
        });

        if (!account) {
            throw new NotFoundException('Account not found');
        }

        const content = await this.prisma.accountContent.create({
            data: {
                account_id: accountId,
                ...contentDto
            }
        });

        await this.clearAccountCache(accountId, undefined, contentDto.language);
        return content;
    }

    async updateAccountContent(accountId: string, language: Language, contentDto: Partial<AccountContentDto>) {
        const account = await this.prisma.account.findUnique({
            where: { id: accountId }
        });

        if (!account) {
            throw new NotFoundException('Account not found');
        }

        const content = await this.prisma.accountContent.update({
            where: {
                account_id_language: {
                    account_id: accountId,
                    language
                }
            },
            data: contentDto
        });

        await this.clearAccountCache(accountId, undefined, language);
        return content;
    }

    async getAccountTranslations(accountId: string) {
        return this.prisma.accountContent.findMany({
            where: { account_id: accountId },
            select: {
                language: true,
                name: true,
                description: true,
                profile_description: true,
                related_activity_history: true,
                auto_translated: true,
            }
        });
    }

    // ==================== متدهای کمکی ====================

    private mergeMultilingualContent(account: any, language: Language) {
        if (!account) return account;

        const content = account.contents?.find((c: any) => c.language === language);

        if (!content) {
            // اگر ترجمه پیدا نشد، از اولین ترجمه موجود استفاده کن
            const firstContent = account.contents?.[0];
            if (!firstContent) {
                return {
                    ...account,
                    name: 'No translation available',
                    description: 'No translation available',
                    profile_description: 'No translation available',
                    contents: undefined
                };
            }

            return {
                ...account,
                name: firstContent.name,
                description: firstContent.description,
                profile_description: firstContent.profile_description,
                activity_domain: firstContent.activity_domain,
                related_activity_history: firstContent.related_activity_history,
                contents: undefined
            };
        }

        return {
            ...account,
            name: content.name,
            description: content.description,
            profile_description: content.profile_description,
            activity_domain: content.activity_domain,
            related_activity_history: content.related_activity_history,
            contents: undefined
        };
    }

    private getAccountInclude(language: Language) {
        return {
            contents: {
                where: { language }
            },
            industry: {
                include: {
                    contents: {
                        where: { language: Language.fa } // صنف‌ها فقط فارسی دارند
                    }
                }
            },
            // 🔥 شامل کردن اطلاعات لوکیشن‌ها
            location_level_1: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            location_level_2: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            location_level_3: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            location_level_4: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            files: {
                select: {
                    id: true,
                    file_path: true,
                    thumbnail_path: true,
                    file_usage: true,
                    description: true,
                    created_at: true,
                },
                orderBy: { created_at: 'desc' as Prisma.SortOrder }, // ✅ استفاده از Prisma.SortOrder
            },
        };
    }

    private getDetailedAccountInclude(language: Language) {
        return {
            contents: {
                where: { language }
            },
            industry: {
                include: {
                    contents: {
                        where: { language: Language.fa }
                    }
                }
            },
            location_level_1: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            location_level_2: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            location_level_3: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            location_level_4: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            brands: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            // 🔥 اضافه کردن account_users با include درست
            account_users: {
                include: {
                    user: {
                        include: {
                            contents: {
                                where: { language }
                            }
                        },
                        select: {
                            id: true,
                            mobile: true,
                            email: true,
                            user_name: true,
                            // اضافه کردن سایر فیلدهای اصلی مورد نیاز
                            is_verified: true,
                            created_at: true,
                        }
                    }
                }
            },
        };
    }

    private async validateLocations(dto: CreateAccountDto | UpdateAccountDto) {
        const locationIds = [
            dto.location_level_1_id,
            dto.location_level_2_id,
            dto.location_level_3_id,
            dto.location_level_4_id,
        ].filter(Boolean);

        if (locationIds.length > 0) {
            const existingLocations = await this.prisma.location.findMany({
                where: { id: { in: locationIds } },
                select: { id: true, type: true }
            });

            // بررسی اینکه همه لوکیشن‌ها وجود دارند
            const foundIds = existingLocations.map(loc => loc.id);
            const missingIds = locationIds.filter(id => !foundIds.includes(id));

            if (missingIds.length > 0) {
                throw new BadRequestException(`لوکیشن‌های یافت نشد: ${missingIds.join(', ')}`);
            }
        }
    }



    private async validateAccountAccess(
        accountId: string,
        user_id: string,
        userRole: SystemRole,
    ): Promise<boolean> {
        if (userRole === SystemRole.ADMIN) {
            return true;
        }

        const accountUser = await this.prisma.accountUser.findUnique({
            where: {
                user_id_account_id: {
                    user_id: user_id,
                    account_id: accountId,
                },
            },
        });

        return !!accountUser;
    }

    private async clearAccountCache(accountId: string, userId?: string, language?: Language) {
        const cacheKeys = [
            `account:${accountId}:${language || '*'}`,
            userId ? `user_accounts:${userId}:${language || '*'}` : '',
        ].filter(Boolean);

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }

    private async clearUserAccountsCache(user_id: string) {
        const cacheKeys = Object.values(Language).map(lang =>
            `user_accounts:${user_id}:${lang}`
        );
        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }

    // ادامه AccountService - متدهای مدیریتی
// در کلاس AccountService اضافه کنید:

    async findAllAdmin(query: AccountQueryDto, language: Language = Language.fa) {
        const cacheKey = `admin_accounts:${JSON.stringify(query)}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 10, is_active, confirmed, search, activity_type, industryId, location_level_1_id, location_level_2_id, location_level_3_id } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (is_active !== undefined) where.is_active = is_active;
        if (confirmed !== undefined) where.confirmed = confirmed;
        if (activity_type) where.activity_type = activity_type;
        if (industryId) where.industryId = industryId;
        if (location_level_1_id) where.location_level_1_id = location_level_1_id;
        if (location_level_2_id) where.location_level_2_id = location_level_2_id;
        if (location_level_3_id) where.location_level_3_id = location_level_3_id;

        if (search) {
            where.OR = [
                {
                    contents: {
                        some: {
                            language,
                            name: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
                {
                    contents: {
                        some: {
                            language,
                            description: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
                { public_phone: { contains: search, mode: 'insensitive' } },
                { company_name: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [accounts, total] = await Promise.all([
            this.prisma.account.findMany({
                where,
                skip,
                take: limit,
                include: {
                    ...this.getAccountInclude(language),
                    _count: {
                        select: {
                            products: {
                                where: {
                                    status: ProductStatus.APPROVED,
                                    confirmed: true
                                }
                            },
                            account_users: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.account.count({ where }),
        ]);

        const result = {
            data: accounts.map(account => ({
                ...this.mergeMultilingualContent(account, language),
                // ✅ اضافه کردن فایل‌ها و لوگو
                files: this.formatAccountFiles(account.files),
                logo: this.extractLogoFromFileId(account.files),
            })),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    private async findAdminAccountById(id: string, language: Language) {
        const cacheKey = `account:${id}:admin:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account = await this.prisma.account.findUnique({
            where: { id },
            include: {
                // 🔥 حالا همه چیز در getDetailedAccountInclude هست
                contents: {
                    where: { language }
                },
                industry: {
                    include: {
                        contents: {
                            where: { language: Language.fa }
                        }
                    }
                },
                location_level_1: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                location_level_2: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                location_level_3: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                location_level_4: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                brands: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                account_users: {
                    include: {
                        user: {
                            include: {
                                contents: {
                                    where: { language }
                                }
                            },
                            select: {
                                id: true,
                                mobile: true,
                                email: true,
                                user_name: true,
                                is_verified: true,
                                created_at: true,
                            }
                        }
                    }
                },
                // ✅ اضافه کردن فایل‌ها
                files: {
                    select: {
                        id: true,
                        file_path: true,
                        thumbnail_path: true,
                        file_usage: true,
                        description: true,
                        created_at: true,
                    },
                    orderBy: { created_at: 'desc' },
                },
                _count: {
                    select: {
                        products: true,
                        buy_ads: true,
                        orders: true,
                    },
                },
            },
        });

        if (!account) {
            throw new NotFoundException('کسب‌وکار پیدا نشد');
        }

        // حالا account_users وجود دارد
        const mergedAccount = {
            ...this.mergeMultilingualContent(account, language),
            account_users: account.account_users?.map(au => ({
                ...au,
                user: this.mergeUserMultilingualContent(au.user, language)
            })) || [],
            // ✅ اضافه کردن فایل‌ها و لوگو
            files: this.formatAccountFiles(account.files),
            logo: this.extractLogoFromFileId(account.files),
        };

        await this.cacheManager.set(cacheKey, mergedAccount, this.CACHE_TTL);
        return mergedAccount;
    }
// در کلاس AccountService - اضافه کردن تابع کمکی

    private mergeUserMultilingualContent(user: any, language: Language) {
        if (!user) return user;

        const content = user.contents?.find((c: any) => c.language === language);

        if (!content) {
            // اگر ترجمه پیدا نشد، از اولین ترجمه موجود استفاده کن
            const firstContent = user.contents?.[0];
            if (!firstContent) {
                return {
                    ...user,
                    first_name: 'No translation',
                    last_name: 'No translation',
                    contents: undefined
                };
            }

            return {
                ...user,
                first_name: firstContent.first_name,
                last_name: firstContent.last_name,
                bio: firstContent.bio,
                job_title: firstContent.job_title,
                company: firstContent.company,
                activity_type: firstContent.activity_type,
                coming_from: firstContent.coming_from,
                contents: undefined
            };
        }

        return {
            ...user,
            first_name: content.first_name,
            last_name: content.last_name,
            bio: content.bio,
            job_title: content.job_title,
            company: content.company,
            activity_type: content.activity_type,
            coming_from: content.coming_from,
            contents: undefined
        };
    }
    async remove(id: string, user_id: string, userRole: SystemRole) {
        if (!(await this.validateAccountAccess(id, user_id, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        // بررسی محصولات فعال
        const activeProducts = await this.prisma.product.count({
            where: {
                account_id: id,
                status: {
                    in: [ProductStatus.APPROVED, ProductStatus.PENDING, ProductStatus.EDIT_PENDING]
                }
            },
        });

        if (activeProducts > 0) {
            throw new ConflictException(
                'امکان حذف کسب‌وکار با محصولات فعال وجود ندارد',
            );
        }

        // بررسی آگهی‌های خرید فعال
        const activeBuyAds = await this.prisma.buyAd.count({
            where: {
                account_id: id,
                status: {
                    in: [BuyAdStatus.FULFILLED, ProductStatus.PENDING]
                }
            },
        });

        if (activeBuyAds > 0) {
            throw new ConflictException(
                'امکان حذف کسب‌وکار با آگهی‌های خرید فعال وجود ندارد',
            );
        }

        const deletedAccount = await this.prisma.account.update({
            where: { id },
            data: { is_active: false, confirmed: false },
        });

        // غیرفعال کردن محصولات مرتبط
        await this.prisma.product.updateMany({
            where: { account_id: id },
            data: { status: ProductStatus.INACTIVE }
        });

        // غیرفعال کردن آگهی‌های خرید
        await this.prisma.buyAd.updateMany({
            where: { account_id: id },
            data: { status: ProductStatus.INACTIVE }
        });

        // پاک کردن کش برای همه زبان‌ها
        await this.clearAllAccountCache(id, user_id);

        return deletedAccount;
    }

    private async clearAllAccountCache(accountId: string, userId?: string) {
        const cacheKeys = [];

        // پاک کردن کش برای همه زبان‌ها
        Object.values(Language).forEach(lang => {
            cacheKeys.push(`account:${accountId}:${lang}`);
            cacheKeys.push(`account:${accountId}:admin:${lang}`);
            if (userId) {
                cacheKeys.push(`user_accounts:${userId}:${lang}`);
            }
        });

        // پاک کردن کش عمومی
        cacheKeys.push(`account:${accountId}`);
        cacheKeys.push(`account:${accountId}:admin`);

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }

    // در فایل account.service.ts - اضافه کردن متدهای پابلیک

// ==================== متدهای عمومی (Public) ====================

    async getPublicAccount(id: string, language: Language = Language.fa) {
        const cacheKey = `public_account:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account = await this.prisma.account.findUnique({
            where: {
                id,
                is_active: true,
                confirmed: true
            },
            include: {
                contents: {
                    where: { language }
                },
                industry: {
                    include: {
                        contents: {
                            where: { language: Language.fa }
                        }
                    }
                },
                location_level_1: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                location_level_2: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                location_level_3: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                // ✅ اضافه کردن فایل‌ها برای public
                files: {
                    where: {
                        file_usage: {
                            in: [
                                FileUsage.LOGO,
                                FileUsage.BANNER,
                                FileUsage.SHOP_FRONT,
                                FileUsage.INTERIOR_PHOTO,
                                FileUsage.SHOP_VIDEO
                            ]
                        }
                    },
                    select: {
                        id: true,
                        file_path: true,
                        thumbnail_path: true,
                        file_usage: true,
                        description: true,
                        created_at: true,
                    },
                    orderBy: { created_at: 'desc' },
                },
                _count: {
                    select: {
                        products: {
                            where: {
                                status: 'APPROVED',
                                confirmed: true
                            }
                        },
                        reviews: {
                            where: {
                                confirmed: true
                            }
                        }
                    }
                }
            }
        });

        if (!account) {
            throw new NotFoundException('حساب یافت نشد');
        }

        const result = {
            ...this.formatPublicAccount(account, language),
            // ✅ اضافه کردن فایل‌ها و لوگو
            files: this.formatAccountFiles(account.files),
            logo: this.extractLogoFromFileId(account.files),
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async getAccountInteractionsStats(id: string, language: Language = Language.fa) {
        const account = await this.prisma.account.findUnique({
            where: {
                id,
                is_active: true
            },
            select: {
                id: true,
                contents: {
                    where: { language },
                    select: { name: true }
                }
            }
        });

        if (!account) {
            throw new NotFoundException('حساب یافت نشد');
        }

        const stats = await this.prisma.interaction.groupBy({
            by: ['type'],
            where: {
                account_id: id,
                type: { in: ['LIKE', 'SAVE'] }
            },
            _count: true
        });

        return {
            accountId: id,
            accountName: account.contents?.[0]?.name || 'No name',
            stats,
            totalLikes: stats.find(s => s.type === 'LIKE')?._count || 0,
            totalSaves: stats.find(s => s.type === 'SAVE')?._count || 0,
            total: stats.reduce((sum, stat) => sum + stat._count, 0)
        };
    }

    async getPopularAccounts(limit: number = 10, language: Language = Language.fa) {
        const cacheKey = `popular_accounts:${limit}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const popularAccounts = await this.prisma.interaction.groupBy({
            by: ['account_id'],
            where: {
                account_id: { not: null },
                type: { in: ['LIKE', 'SAVE'] },
                account: {
                    is_active: true,
                    confirmed: true
                }
            },
            _count: {
                _all: true
            },
            orderBy: {
                _count: {
                    account_id: 'desc'
                }
            },
            take: limit
        });

        const accountIds = popularAccounts.map(a => a.account_id);
        const accounts = await this.prisma.account.findMany({
            where: {
                id: { in: accountIds },
                is_active: true,
                confirmed: true
            },
            include: {
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        products: {
                            where: {
                                status: 'APPROVED',
                                confirmed: true
                            }
                        }
                    }
                }
            }
        });

        const result = popularAccounts.map(popular => {
            const account = accounts.find(a => a.id === popular.account_id);
            const content = account?.contents?.[0];

            return {
                account: {
                    id: account?.id,
                    name: content?.name, // ✅ فقط از content استفاده کن - account.name وجود ندارد
                    profile_photo: account?.profile_photo,
                    activity_type: account?.activity_type,
                    total_views: account?.total_views,
                    total_likes: account?.total_likes,
                    product_count: account?._count.products
                },
                interactionCount: popular._count,
                rank: popularAccounts.indexOf(popular) + 1
            };
        });

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async searchPublicAccounts(
        query: string,
        industryId: string,
        activityType: string,
        cityId: string,
        page: number = 1,
        limit: number = 20,
        language: Language = Language.fa
    ) {
        const cacheKey = `account_search:${JSON.stringify({query, industryId, activityType, cityId, page, limit})}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const skip = (page - 1) * limit;

        const where: any = {
            is_active: true,
            confirmed: true
        };

        if (query) {
            where.OR = [
                {
                    contents: {
                        some: {
                            language,
                            name: { contains: query, mode: 'insensitive' }
                        }
                    }
                },
                {
                    contents: {
                        some: {
                            language,
                            description: { contains: query, mode: 'insensitive' }
                        }
                    }
                },
                { public_phone: { contains: query, mode: 'insensitive' } }
            ];
        }

        if (industryId) where.industryId = industryId;
        if (activityType) where.activity_type = activityType;
        if (cityId) where.location_level_3_id = cityId;

        const [accounts, total] = await Promise.all([
            this.prisma.account.findMany({
                where,
                skip,
                take: limit,
                include: {
                    contents: {
                        where: { language }
                    },
                    industry: {
                        include: {
                            contents: {
                                where: { language: Language.fa }
                            }
                        }
                    },
                    location_level_3: {
                        include: {
                            contents: {
                                where: { language }
                            }
                        }
                    },
                    _count: {
                        select: {
                            products: {
                                where: {
                                    status: 'APPROVED',
                                    confirmed: true
                                }
                            }
                        }
                    }
                },
                orderBy: { total_views: 'desc' }
            }),
            this.prisma.account.count({ where })
        ]);

        const result = {
            data: accounts.map(account => this.formatPublicAccountSearch(account, language)),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

// ==================== متدهای کمکی فرمت‌بندی ====================

    private formatPublicAccount(account: any, language: Language) {
        const content = account.contents?.[0] || {};

        return {
            id: account.id,
            name: content.name || account.name,
            description: content.description || account.description,
            profile_description: content.profile_description || account.profile_description,
            activity_type: account.activity_type,
            industry: account.industry ? {
                id: account.industry.id,
                name: account.industry.contents?.[0]?.name || account.industry.name
            } : null,
            location: this.formatLocation(account, language),
            profile_photo: account.profile_photo,
            public_phone: account.public_phone,
            total_views: account.total_views,
            total_likes: account.total_likes,
            stats: {
                products: account._count.products,
                reviews: account._count.reviews
            },
            created_at: account.created_at
        };
    }

    private formatPublicAccountSearch(account: any, language: Language) {
        const content = account.contents?.[0] || {};

        return {
            id: account.id,
            name: content.name || account.name,
            description: content.description || account.description,
            profile_description: content.profile_description || account.profile_description,
            profile_photo: account.profile_photo,
            activity_type: account.activity_type,
            public_phone: account.public_phone,
            total_views: account.total_views,
            total_likes: account.total_likes,
            industry: account.industry ? {
                id: account.industry.id,
                name: account.industry.contents?.[0]?.name || account.industry.name
            } : null,
            location: account.location_level_3 ? {
                id: account.location_level_3.id,
                name: account.location_level_3.contents?.[0]?.name
            } : null,
            stats: {
                products: account._count.products
            },
            created_at: account.created_at
        };
    }

    private formatLocation(account: any, language: Language) {
        const locationParts = [];

        if (account.location_level_3) {
            locationParts.push(account.location_level_3.contents?.[0]?.name);
        }
        if (account.location_level_2) {
            locationParts.push(account.location_level_2.contents?.[0]?.name);
        }
        if (account.location_level_1) {
            locationParts.push(account.location_level_1.contents?.[0]?.name);
        }

        return locationParts.length > 0 ? locationParts.join('، ') : null;
    }

    // در کلاس AccountService - اضافه کردن متد updateConfirmation

    async updateConfirmation(id: string, confirmed: boolean) {
        const account = await this.prisma.account.findUnique({
            where: { id },
            include: {
                account_users: {
                    where: { account_role: AccountRole.OWNER },
                    take: 1,
                },
            },
        });

        if (!account) {
            throw new NotFoundException('کسب‌وکار پیدا نشد');
        }

        const updatedAccount = await this.prisma.account.update({
            where: { id },
            data: { confirmed },
        });

        // پاک کردن کش
        const ownerUserId = account.account_users[0]?.user_id;
        await Promise.all([
            this.cacheManager.del(`account:${id}`),
            this.cacheManager.del(`account:${id}:admin`),
            ownerUserId ? this.clearUserAccountsCache(ownerUserId) : Promise.resolve(),

            // پاک کردن کش برای همه زبان‌ها
            ...Object.values(Language).map(lang =>
                this.cacheManager.del(`account:${id}:${lang}`)
            ),
            ...Object.values(Language).map(lang =>
                this.cacheManager.del(`account:${id}:admin:${lang}`)
            ),

            // پاک کردن کش عمومی
            this.cacheManager.del(`public_account:${id}:*`),
        ]);

        return updatedAccount;
    }
    private async findAdminAccounts(query: AccountQueryDto, language: Language) {
        const cacheKey = `admin_accounts:${JSON.stringify(query)}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 10, is_active, confirmed, search, activity_type, industryId, location_level_1_id, location_level_2_id, location_level_3_id } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (is_active !== undefined) where.is_active = is_active;
        if (confirmed !== undefined) where.confirmed = confirmed;
        if (activity_type) where.activity_type = activity_type;
        if (industryId) where.industryId = industryId;
        if (location_level_1_id) where.location_level_1_id = location_level_1_id;
        if (location_level_2_id) where.location_level_2_id = location_level_2_id;
        if (location_level_3_id) where.location_level_3_id = location_level_3_id;

        if (search) {
            where.OR = [
                {
                    contents: {
                        some: {
                            language,
                            name: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
                {
                    contents: {
                        some: {
                            language,
                            description: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
                { public_phone: { contains: search, mode: 'insensitive' } },
                { company_name: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [accounts, total] = await Promise.all([
            this.prisma.account.findMany({
                where,
                skip,
                take: limit,
                include: {
                    ...this.getAccountInclude(language),
                    _count: {
                        select: {
                            products: {
                                where: {
                                    status: ProductStatus.APPROVED,
                                    confirmed: true
                                }
                            },
                            account_users: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.account.count({ where }),
        ]);

        const result = {
            data: accounts.map(account => this.mergeMultilingualContent(account, language)),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    private async deleteAccount(id: string, user_id: string, userRole: SystemRole) {
        if (!(await this.validateAccountAccess(id, user_id, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        // بررسی محصولات فعال
        const activeProducts = await this.prisma.product.count({
            where: {
                account_id: id,
                status: {
                    in: [ProductStatus.APPROVED, ProductStatus.PENDING, ProductStatus.EDIT_PENDING]
                }
            },
        });

        if (activeProducts > 0) {
            throw new ConflictException(
                'امکان حذف کسب‌وکار با محصولات فعال وجود ندارد',
            );
        }

        // بررسی آگهی‌های خرید فعال
        const activeBuyAds = await this.prisma.buyAd.count({
            where: {
                account_id: id,
                status: {
                    in: [BuyAdStatus.APPROVED, ProductStatus.PENDING]
                }
            },
        });

        if (activeBuyAds > 0) {
            throw new ConflictException(
                'امکان حذف کسب‌وکار با آگهی‌های خرید فعال وجود ندارد',
            );
        }

        const deletedAccount = await this.prisma.account.update({
            where: { id },
            data: { is_active: false, confirmed: false },
        });

        // غیرفعال کردن محصولات مرتبط
        await this.prisma.product.updateMany({
            where: { account_id: id },
            data: { status: ProductStatus.INACTIVE }
        });

        // غیرفعال کردن آگهی‌های خرید
        await this.prisma.buyAd.updateMany({
            where: { account_id: id },
            data: { status: BuyAdStatus.INACTIVE }
        });

        // پاک کردن کش برای همه زبان‌ها
        await this.clearAllAccountCache(id, user_id);

        return deletedAccount;
    }

// در کلاس AccountService - اضافه کردن متدهای مفقوده

// ==================== متدهای مدیریت فایل ====================

    async setAccountFile(
        accountId: string,
        userId: string,
        userRole: SystemRole,
        file: Express.Multer.File,
        fileUsage: FileUsage,
        description?: string,
        language: Language = Language.fa // ✅ اضافه کردن پارامتر زبان
    ) {
        // بررسی دسترسی به اکانت
        if (!(await this.validateAccountAccess(accountId, userId, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        // بررسی وجود اکانت با محتوای چندزبانه
        const account = await this.prisma.account.findUnique({
            where: { id: accountId },
            include: {
                contents: {
                    where: { language }
                }
            }
        });

        if (!account) {
            throw new NotFoundException('کسب‌وکار یافت نشد');
        }

        if (!this.isBusinessFileUsage(fileUsage)) {
            throw new BadRequestException('این نوع فایل برای کسب‌وکار مجاز نیست');
        }

        // پیدا کردن فایل قبلی با همین usage
        const existingFile = await this.prisma.file.findFirst({
            where: {
                account_id: accountId,
                file_usage: fileUsage,
            },
        });

        // ✅ گرفتن نام اکانت از محتوای چندزبانه
        const accountName = account.contents?.[0]?.name || 'کسب‌وکار';

        // آماده‌سازی داده‌های آپلود
        const uploadDto = {
            file_usage: fileUsage,
            description: description || this.getFileUsageDescription(fileUsage, accountName), // ✅ استفاده از accountName
            account_id: accountId,
        };

        let newFileRecord;

        try {
            // آپلود فایل جدید
            newFileRecord = await this.fileService.uploadFile(file, uploadDto, userId);

            // اگر فایل قبلی وجود داشت، حذفش کن
            if (existingFile) {
                await this.fileService.deleteFile(existingFile.id, userId);
            }

            // پاک کردن کش مربوط به اکانت
            await this.clearAccountCache(accountId, userId);

            // اگر لوگو آپلود شده، آپدیت فیلد profile_photo در اکانت
            if (fileUsage === FileUsage.LOGO) {
                await this.prisma.account.update({
                    where: { id: accountId },
                    data: { profile_photo: newFileRecord.file_path },
                });
            }

            return {
                message: 'فایل با موفقیت بروزرسانی شد',
                file: newFileRecord,
            };

        } catch (error) {
            // اگر خطا در آپلود فایل جدید رخ داد و فایل قبلی داشتیم، آن را حفظ کنیم
            if (existingFile && newFileRecord) {
                await this.fileService.deleteFile(newFileRecord.id, userId);
            }
            throw error;
        }
    }

    async removeAccountFile(
        accountId: string,
        userId: string,
        userRole: SystemRole,
        fileUsage: FileUsage,
    ) {
        // بررسی دسترسی به اکانت
        if (!(await this.validateAccountAccess(accountId, userId, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        // پیدا کردن فایل
        const accountFile = await this.prisma.file.findFirst({
            where: {
                account_id: accountId,
                file_usage: fileUsage,
            },
        });

        if (!accountFile) {
            throw new NotFoundException('فایل یافت نشد');
        }

        // حذف فایل
        await this.fileService.deleteFile(accountFile.id, userId);

        // اگر لوگو حذف شده، فیلد profile_photo را در اکانت پاک کن
        if (fileUsage === FileUsage.LOGO) {
            await this.prisma.account.update({
                where: { id: accountId },
                data: { profile_photo: null },
            });
        }

        // پاک کردن کش
        await this.clearAccountCache(accountId, userId);

        return {
            message: 'فایل با موفقیت حذف شد',
        };
    }

    async getAccountFiles(
        accountId: string,
        userId: string,
        userRole: SystemRole,
        fileUsage?: FileUsage,
    ) {
        // بررسی دسترسی به اکانت
        if (!(await this.validateAccountAccess(accountId, userId, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        const where: any = { account_id: accountId };
        if (fileUsage) where.file_usage = fileUsage;

        const files = await this.prisma.file.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        user_name: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        return {
            account_id: accountId,
            files: files.map(file => ({
                id: file.id,
                file_usage: file.file_usage,
                description: file.description,
                created_at: file.created_at,
                file_path: file.file_path,
                thumbnail_path: file.thumbnail_path,
                uploaded_by: file.user ? {
                    id: file.user.id,
                    name: file.user.user_name,
                } : null,
                url: `/files/stream/${file.id}`,
                thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
            })),
        };
    }

    async getAccountFile(
        accountId: string,
        fileId: string,
        userId: string,
        userRole: SystemRole,
    ) {
        // بررسی دسترسی به اکانت
        if (!(await this.validateAccountAccess(accountId, userId, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        const file = await this.prisma.file.findFirst({
            where: {
                id: fileId,
                account_id: accountId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        user_name: true,
                    },
                },
            },
        });

        if (!file) {
            throw new NotFoundException('فایل یافت نشد');
        }

        return {
            id: file.id,
            file_usage: file.file_usage,
            description: file.description,
            created_at: file.created_at,
            file_path: file.file_path,
            thumbnail_path: file.thumbnail_path,
            uploaded_by: file.user ? {
                id: file.user.id,
                name: file.user.user_name,
            } : null,
            url: `/files/stream/${file.id}`,
            thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
        };
    }

// ==================== متدهای مدیریتی ====================

    async findOneAdmin(id: string, language: Language = Language.fa) {
        return this.findAdminAccountById(id, language);
    }


// ==================== متدهای کمکی مدیریت فایل ====================

    private isBusinessFileUsage(fileUsage: FileUsage): boolean {
        const businessFileUsages: FileUsage[] = [
            FileUsage.LOGO,
            FileUsage.BANNER,
            FileUsage.SHOP_FRONT,
            FileUsage.INTERIOR_PHOTO,
            FileUsage.SHOP_VIDEO,
            FileUsage.CERTIFICATE,
            FileUsage.LICENSE,
            FileUsage.TAX_DOCUMENT,
            FileUsage.REGISTRATION_DOC,
            FileUsage.TEAM_PHOTO,
        ];

        return businessFileUsages.includes(fileUsage);
    }

    private getFileUsageDescription(fileUsage: FileUsage, accountName: string): string {
        const descriptions = {
            [FileUsage.LOGO]: `لوگوی کسب‌وکار ${accountName}`,
            [FileUsage.BANNER]: `بنر کسب‌وکار ${accountName}`,
            [FileUsage.SHOP_FRONT]: `تصویر نمای بیرونی ${accountName}`,
            [FileUsage.INTERIOR_PHOTO]: `تصویر فضای داخلی ${accountName}`,
            [FileUsage.SHOP_VIDEO]: `ویدئوی معرفی ${accountName}`,
            [FileUsage.CERTIFICATE]: `گواهی‌نامه ${accountName}`,
            [FileUsage.LICENSE]: `پروانه کسب ${accountName}`,
            [FileUsage.TAX_DOCUMENT]: `اسناد مالیاتی ${accountName}`,
            [FileUsage.REGISTRATION_DOC]: `اسناد ثبت ${accountName}`,
            [FileUsage.TEAM_PHOTO]: `تصویر تیم ${accountName}`,
        };

        return descriptions[fileUsage] || `فایل ${fileUsage} برای ${accountName}`;
    }

    // ایجاد اکانت شخصی پیشفرض
    async createPersonalAccount(
        user_id: string,
        accountName: string,
        accountDescription?: string,
        language: Language = Language.fa
    ) {

        const createAccountDto: CreateAccountDto = {
            // فیلدهای اصلی Account (غیرقابل ترجمه)
            activity_type: AccountActivityType.PERSONAL,
            is_company: false,
            business_tags: ['personal', 'individual'],

            // 🔥 محتوای چندزبانه - اینجا name و description قرار می‌گیرد
            contents: [
                {
                    language: language,
                    name: accountName,
                    description: accountDescription,
                    profile_description: accountDescription,
                    auto_translated: false,

                }
            ]
        };

        return await this.createAccount(user_id, createAccountDto, language);
    }
    async createBusinessAccount(
        user_id: string,
        business_name: string,
        activity_type: AccountActivityType,
        language: Language = Language.fa
    ) {
        const createAccountDto: CreateAccountDto = {
            activity_type,
            is_company: true, // ✅ مشخص کردن که این یک کسب‌وکار شرکتی است
            contents: [{
                language,
                name: business_name, // ✅ نام کسب‌وکار در فیلد name ذخیره می‌شود
                description: `کسب‌وکار ${business_name}`,
                profile_description: `پروفایل کسب‌وکار ${business_name}`,
                auto_translated: false
            }]
        };

        return await this.createAccount(user_id, createAccountDto, language);
    }

// متد کمکی برای فرمت‌بندی پاسخ
    private formatAccountForAuth(account: any, language: Language) {
        const content = account.contents?.find((c: any) => c.language === language) || account.contents?.[0];

        return {
            id: account.id,
            title: content?.name || account.name,
            provider: account.industry?.contents?.[0]?.name || account.industry?.name,
            status: account.confirmed ? 'active' : 'pending',
            createdOn: account.created_at,
            activePlan: null, // می‌توانید بعداً اضافه کنید
            reservedPlan: null // می‌توانید بعداً اضافه کنید
        };
    }





}