import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    Inject,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AccountRole, SystemRole, Language } from '@prisma/client';
import { AddUserToAccountDto } from './dto/add-user-to-account.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AccountUserQueryDto } from './dto/account-user-query.dto';

@Injectable()
export class AccountUserService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private readonly CACHE_TTL = 5 * 60 * 1000;

    // ==================== متدهای اصلی ====================

    async addUserToAccount(
        accountId: string,
        ownerUserId: string,
        addUserDto: AddUserToAccountDto,
        language: Language = Language.fa
    ) {
        // بررسی وجود اکانت
        const account = await this.prisma.account.findUnique({
            where: { id: accountId, is_active: true },
        });

        if (!account) {
            throw new NotFoundException('کسب‌وکار پیدا نشد');
        }

        // بررسی مالکیت
        const isOwner = await this.validateOwnerAccess(accountId, ownerUserId);
        if (!isOwner) {
            throw new ForbiddenException('فقط مالک کسب‌وکار می‌تواند کاربر اضافه کند');
        }

        // بررسی وجود کاربر هدف
        const targetUser = await this.prisma.user.findUnique({
            where: { id: addUserDto.target_user_id },
        });

        if (!targetUser) {
            throw new NotFoundException('کاربر مورد نظر پیدا نشد');
        }

        // بررسی اینکه کاربر قبلاً اضافه نشده باشد
        const existingRelation = await this.prisma.accountUser.findUnique({
            where: {
                user_id_account_id: {
                    user_id: addUserDto.target_user_id,
                    account_id: accountId,
                },
            },
        });

        if (existingRelation) {
            throw new ConflictException('این کاربر قبلاً به کسب‌وکار اضافه شده است');
        }

        // ایجاد رابطه
        const accountUser = await this.prisma.accountUser.create({
            data: {
                user_id: addUserDto.target_user_id,
                account_id: accountId,
                account_role: addUserDto.role,
            },
            include: {
                user: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
            },
        });

        // پاک کردن کش‌های مرتبط
        await this.clearAccountUsersCache(accountId);

        return this.mergeUserMultilingualContent(accountUser, language);
    }

    async getAccountUsers(accountId: string, user_id: string, userRole: SystemRole, language: Language = Language.fa) {
        const cacheKey = `account_users:${accountId}:${language}`;

        // بررسی دسترسی
        if (!(await this.validateAccountAccess(accountId, user_id, userRole))) {
            throw new ForbiddenException('دسترسی غیرمجاز');
        }

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account_users = await this.prisma.accountUser.findMany({
            where: {
                account_id: accountId,
            },
            include: {
                user: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const result = account_users.map(au =>
            this.mergeUserMultilingualContent(au, language)
        );

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async updateUserRole(
        accountId: string,
        ownerUserId: string,
        targetUserId: string,
        updateRoleDto: UpdateUserRoleDto,
        language: Language = Language.fa
    ) {
        // بررسی مالکیت
        const isOwner = await this.validateOwnerAccess(accountId, ownerUserId);
        if (!isOwner) {
            throw new ForbiddenException('فقط مالک کسب‌وکار می‌تواند نقش کاربران را تغییر دهد');
        }

        // کاربر نمی‌تواند نقش خودش را تغییر دهد
        if (ownerUserId === targetUserId) {
            throw new BadRequestException('شما نمی‌توانید نقش خودتان را تغییر دهید');
        }

        const updatedAccountUser = await this.prisma.accountUser.update({
            where: {
                user_id_account_id: {
                    user_id: targetUserId,
                    account_id: accountId,
                },
            },
            data: {
                account_role: updateRoleDto.role,
            },
            include: {
                user: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
            },
        });

        // پاک کردن کش
        await this.clearAccountUsersCache(accountId);

        return this.mergeUserMultilingualContent(updatedAccountUser, language);
    }

    async removeUserFromAccount(
        accountId: string,
        ownerUserId: string,
        targetUserId: string,
    ) {
        // بررسی مالکیت
        const isOwner = await this.validateOwnerAccess(accountId, ownerUserId);
        if (!isOwner) {
            throw new ForbiddenException('فقط مالک کسب‌وکار می‌تواند کاربر حذف کند');
        }

        // کاربر نمی‌تواند خودش را حذف کند
        if (ownerUserId === targetUserId) {
            throw new BadRequestException('شما نمی‌توانید خودتان را از اکانت حذف کنید');
        }

        await this.prisma.accountUser.delete({
            where: {
                user_id_account_id: {
                    user_id: targetUserId,
                    account_id: accountId,
                },
            },
        });

        // پاک کردن کش
        await this.clearAccountUsersCache(accountId);

        return { message: 'کاربر با موفقیت از کسب‌وکار حذف شد' };
    }

    async getUserAccounts(user_id: string, language: Language = Language.fa) {
        const cacheKey = `user_accounts_list:${user_id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account_users = await this.prisma.accountUser.findMany({
            where: {
                user_id: user_id,
                account: {
                    is_active: true,
                },
            },
            include: {
                account: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const result = account_users.map(au => ({
            ...this.mergeAccountMultilingualContent(au.account, language),
            userRole: au.account_role,
        }));

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    // ==================== متدهای ادمین ====================

    async getAllAccountUsersAdmin(query: AccountUserQueryDto, language: Language = Language.fa) {
        const cacheKey = `admin_all_account_users:${JSON.stringify(query)}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 10, search } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.OR = [
                {
                    user: {
                        contents: {
                            some: {
                                language,
                                OR: [
                                    { first_name: { contains: search, mode: 'insensitive' } },
                                    { last_name: { contains: search, mode: 'insensitive' } },
                                ]
                            }
                        }
                    },
                },
                {
                    user: {
                        mobile: { contains: search, mode: 'insensitive' },
                    },
                },
                {
                    account: {
                        contents: {
                            some: {
                                language,
                                name: { contains: search, mode: 'insensitive' }
                            }
                        }
                    },
                },
            ];
        }

        const [account_users, total] = await Promise.all([
            this.prisma.accountUser.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        include: {
                            contents: {
                                where: { language }
                            }
                        }
                    },
                    account: {
                        include: {
                            contents: {
                                where: { language }
                            }
                        }
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.accountUser.count({ where }),
        ]);

        const result = {
            data: account_users.map(au => ({
                ...au,
                user: this.mergeUserMultilingualContent(au.user, language),
                account: this.mergeAccountMultilingualContent(au.account, language)
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

    async getAccountUsersAdmin(accountId: string, language: Language = Language.fa) {
        const cacheKey = `admin_account_users:${accountId}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account_users = await this.prisma.accountUser.findMany({
            where: {
                account_id: accountId,
            },
            include: {
                user: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const result = account_users.map(au =>
            this.mergeUserMultilingualContent(au, language)
        );

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async getUserAccountsAdmin(user_id: string, language: Language = Language.fa) {
        const cacheKey = `admin_user_accounts:${user_id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const account_users = await this.prisma.accountUser.findMany({
            where: {
                user_id: user_id,
            },
            include: {
                account: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const result = account_users.map(au => ({
            ...this.mergeAccountMultilingualContent(au.account, language),
            userRole: au.account_role,
        }));

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async removeUserFromAccountAdmin(accountId: string, user_id: string) {
        await this.prisma.accountUser.delete({
            where: {
                user_id_account_id: {
                    user_id: user_id,
                    account_id: accountId,
                },
            },
        });

        // پاک کردن کش‌های مرتبط برای همه زبان‌ها
        await Promise.all([
            this.clearAllAccountUsersCache(accountId),
            this.cacheManager.del(`admin_account_users:${accountId}:*`),
            this.cacheManager.del(`admin_user_accounts:${user_id}:*`),
        ]);

        return { message: 'کاربر با موفقیت از کسب‌وکار حذف شد' };
    }

    // ==================== متدهای کمکی ====================

    private mergeUserMultilingualContent(accountUser: any, language: Language) {
        if (!accountUser.user) return accountUser;

        const userContent = accountUser.user.contents?.find((c: any) => c.language === language);
        const firstContent = accountUser.user.contents?.[0];

        return {
            ...accountUser,
            user: {
                id: accountUser.user.id,
                mobile: accountUser.user.mobile,
                email: accountUser.user.email,
                user_name: accountUser.user.user_name,
                system_role: accountUser.user.system_role,
                first_name: userContent?.first_name || firstContent?.first_name || 'No name',
                last_name: userContent?.last_name || firstContent?.last_name || 'No name',
            }
        };
    }

    private mergeAccountMultilingualContent(account: any, language: Language) {
        if (!account) return account;

        const content = account.contents?.find((c: any) => c.language === language);
        const firstContent = account.contents?.[0];

        return {
            id: account.id,
            name: content?.name || firstContent?.name || account.name,
            public_phone: account.public_phone,
            current_badge_type: account.current_badge_type,
            is_active: account.is_active,
            confirmed: account.confirmed,
        };
    }

    private async validateOwnerAccess(accountId: string, user_id: string): Promise<boolean> {
        const ownerRelation = await this.prisma.accountUser.findUnique({
            where: {
                user_id_account_id: {
                    user_id: user_id,
                    account_id: accountId,
                },
                account_role: AccountRole.OWNER,
            },
        });

        return !!ownerRelation;
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

    private async clearAccountUsersCache(accountId: string) {
        const cacheKeys = Object.values(Language).map(lang =>
            `account_users:${accountId}:${lang}`
        );
        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }

    private async clearAllAccountUsersCache(accountId: string) {
        const cacheKeys = [
            ...Object.values(Language).map(lang => `account_users:${accountId}:${lang}`),
            ...Object.values(Language).map(lang => `admin_account_users:${accountId}:${lang}`),
            `user_accounts_list:*`, // پاک کردن کش لیست اکانت‌های کاربران
        ];
        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }
}