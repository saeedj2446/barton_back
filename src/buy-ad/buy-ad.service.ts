// src/buy-ad/buy-ad.service.ts
import { Injectable, NotFoundException, ForbiddenException, ConflictException, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuyAdDto } from './dto/create-buy-ad.dto';
import { UpdateBuyAdDto } from './dto/update-buy-ad.dto';
import { BuyAdQueryDto } from './dto/buy-ad-query.dto';
import {
    BuyAdType,
    BuyAdStatus,
    ProductStatus,
    SystemRole,
    AccountRole,
    Prisma,
    OfferStatus,
    Language
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class BuyAdService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private readonly CACHE_TTL = 5 * 60 * 1000;

    // ==================== ایجاد درخواست خرید جدید (چندزبانه) ====================
    async create(createBuyAdDto: CreateBuyAdDto, userId: string, language: Language = Language.fa) {
        // اعتبارسنجی اکانت و دسترسی
        const account = await this.prisma.account.findUnique({
            where: { id: createBuyAdDto.account_id, is_active: true }
        });

        if (!account) {
            throw new NotFoundException('Account not found or inactive');
        }

        const accountUser = await this.prisma.accountUser.findUnique({
            where: {
                user_id_account_id: {
                    user_id: userId,
                    account_id: createBuyAdDto.account_id,
                }
            }
        });

        if (!accountUser) {
            throw new ForbiddenException('No access to this account');
        }

        return this.prisma.$transaction(async (tx) => {
            // ایجاد درخواست خرید اصلی
            const buyAdData: any = {
                requirement_amount: createBuyAdDto.requirement_amount,
                unit: createBuyAdDto.unit,
                type: createBuyAdDto.type || BuyAdType.SIMPLE,
                status: BuyAdStatus.PENDING,
                account_id: createBuyAdDto.account_id,
                user_id: userId,

                // لوکیشن‌های جدید
                location_level_1_id: createBuyAdDto.location_level_1_id,
                location_level_2_id: createBuyAdDto.location_level_2_id,
                location_level_3_id: createBuyAdDto.location_level_3_id,
                location_level_4_id: createBuyAdDto.location_level_4_id,

                // تنظیمات تماس
                allow_phone_contact: createBuyAdDto.allow_phone_contact ?? true,
                allow_message_contact: createBuyAdDto.allow_message_contact ?? true,
                allow_public_offers: createBuyAdDto.allow_public_offers ?? true,

                // شرایط فروشنده
                min_seller_rating: createBuyAdDto.min_seller_rating,
                required_certifications: createBuyAdDto.required_certifications || [],
                preferred_payment_methods: createBuyAdDto.preferred_payment_methods || [],

                // تاریخ انقضا
                expires_at: createBuyAdDto.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 روز
            };

            const buyAd = await tx.buyAd.create({
                data: buyAdData
            });

            // ایجاد محتوای چندزبانه
            if (createBuyAdDto.contents && createBuyAdDto.contents.length > 0) {
                await tx.buyAdContent.createMany({
                    data: createBuyAdDto.contents.map(content => ({
                        buy_ad_id: buyAd.id,
                        language: content.language,
                        name: content.name,
                        description: content.description,
                        category_name: content.category_name,
                        subcategory_name: content.subcategory_name,
                        auto_translated: content.auto_translated ?? true
                    }))
                });
            } else {
                // ایجاد محتوای پیش‌فرض
                await tx.buyAdContent.create({
                    data: {
                        buy_ad_id: buyAd.id,
                        language: language,
                        name: `درخواست خرید ${buyAd.id}`,
                        description: 'توضیحات درخواست خرید',
                        auto_translated: false
                    }
                });
            }

            await this.clearBuyAdCaches(userId, createBuyAdDto.account_id);
            return this.enrichBuyAdWithContent(buyAd, language);
        });
    }

    // ==================== دریافت درخواست خرید با محتوای چندزبانه ====================
    async findOne(id: string, language: Language = Language.fa, userId?: string) {
        const cacheKey = `buy_ad:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id },
            include: {
                account: {
                    select: {
                        id: true,
                        activity_type: true,
                        profile_photo: true,
                        is_company: true,
                        confirmed: true,
                        contents: {
                            where: { language },
                            select: {
                                name: true,
                                company_name: true,
                                description: true,
                                profile_description: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        id: true,
                        user_name: true,
                        is_verified: true,
                        contents: {
                            where: { language },
                            select: { first_name: true, last_name: true }
                        }
                    }
                },
                location_level_1: {
                    include: {
                        contents: {
                            where: { language },
                            select: { name: true, full_name: true }
                        }
                    }
                },
                location_level_2: {
                    include: {
                        contents: {
                            where: { language },
                            select: { name: true, full_name: true }
                        }
                    }
                },
                location_level_3: {
                    include: {
                        contents: {
                            where: { language },
                            select: { name: true, full_name: true }
                        }
                    }
                },
                location_level_4: {
                    include: {
                        contents: {
                            where: { language },
                            select: { name: true, full_name: true }
                        }
                    }
                },
                contents: {
                    where: { language },
                    select: {
                        name: true,
                        description: true,
                        category_name: true,
                        subcategory_name: true
                    }
                },
                _count: {
                    select: {
                        offers: true,
                        Conversation: true
                    }
                }
            }
        });

        if (!buyAd) {
            throw new NotFoundException('Buy ad not found');
        }

        const enrichedBuyAd = this.enrichBuyAdWithContent(buyAd, language);

        // اضافه کردن اطلاعات دسترسی
        if (userId) {
            enrichedBuyAd.user_has_access = await this.checkBuyAdAccess(id, userId);
            enrichedBuyAd.can_make_offer = await this.canUserMakeOffer(buyAd, userId);
        }

        await this.cacheManager.set(cacheKey, enrichedBuyAd, this.CACHE_TTL);
        return enrichedBuyAd;
    }

    // ==================== جستجوی پیشرفته درخواست‌های خرید ====================
    async searchBuyAds(filters: {
        page?: number;
        limit?: number;
        search?: string;
        type?: BuyAdType;
        status?: BuyAdStatus;
        category_id?: number;
        location_level_1_id?: string;
        location_level_2_id?: string;
        location_level_3_id?: string;
        location_level_4_id?: string;
        min_amount?: number;
        max_amount?: number;
        unit?: string;
        sort_by?: string;
        language?: Language;
    }): Promise<{ buy_ads: any[]; total: number; page: number; totalPages: number }> {
        const {
            page = 1,
            limit = 10,
            search,
            type,
            status = BuyAdStatus.APPROVED,
            category_id,
            location_level_1_id,
            location_level_2_id,
            location_level_3_id,
            location_level_4_id,
            min_amount,
            max_amount,
            unit,
            sort_by = 'newest',
            language = Language.fa
        } = filters;

        const skip = (page - 1) * limit;

        const where: Prisma.BuyAdWhereInput = {
            status: status
        };

        // فیلتر جستجو در محتوای چندزبانه
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
                }
            ];
        }

        // فیلترهای دیگر
        if (type) where.type = type;
        if (category_id) where.category_id = category_id;
        if (unit) where.unit = unit;

        // فیلترهای لوکیشن
        if (location_level_1_id) where.location_level_1_id = location_level_1_id;
        if (location_level_2_id) where.location_level_2_id = location_level_2_id;
        if (location_level_3_id) where.location_level_3_id = location_level_3_id;
        if (location_level_4_id) where.location_level_4_id = location_level_4_id;

        // فیلتر مقدار
        if (min_amount !== undefined || max_amount !== undefined) {
            where.requirement_amount = {};
            if (min_amount !== undefined) where.requirement_amount.gte = min_amount;
            if (max_amount !== undefined) where.requirement_amount.lte = max_amount;
        }

        const orderBy = this.buildBuyAdOrderBy(sort_by);

        const [buyAds, total] = await Promise.all([
            this.prisma.buyAd.findMany({
                where,
                skip,
                take: limit,
                include: this.getBuyAdListInclude(language),
                orderBy,
            }),
            this.prisma.buyAd.count({ where }),
        ]);

        const enrichedBuyAds = buyAds.map(buyAd =>
            this.enrichBuyAdWithContent(buyAd, language)
        );

        return {
            buy_ads: enrichedBuyAds,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    // ==================== متدهای کمکی ====================

    private getBuyAdListInclude(language: Language) {
        return {
            account: {
                select: {
                    id: true,
                    name: true,
                    activity_type: true,
                    profile_photo: true,
                    contents: {
                        where: { language },
                        select: { name: true }
                    }
                }
            },
            user: {
                select: {
                    id: true,
                    user_name: true,
                    is_verified: true,
                    contents: {
                        where: { language },
                        select: { first_name: true, last_name: true }
                    }
                }
            },
            contents: {
                where: { language },
                select: {
                    name: true,
                    description: true,
                    category_name: true
                }
            },
            _count: {
                select: {
                    offers: true,
                    Conversation: true
                }
            }
        };
    }

    private enrichBuyAdWithContent(buyAd: any, language: Language) {
        if (!buyAd) return buyAd;

        const content = buyAd.contents?.[0] || {};
        const accountContent = buyAd.account?.contents?.[0] || {};
        const userContent = buyAd.user?.contents?.[0] || {};

        return {
            ...buyAd,
            // بازنویسی فیلدهای قابل ترجمه
            name: content.name,
            description: content.description,
            category_name: content.category_name,
            subcategory_name: content.subcategory_name,

            // اطلاعات حساب با محتوای چندزبانه
            account: buyAd.account ? {
                ...buyAd.account,
                name: accountContent.name || buyAd.account.name
            } : null,

            // اطلاعات کاربر با محتوای چندزبانه
            user: buyAd.user ? {
                ...buyAd.user,
                first_name: userContent.first_name,
                last_name: userContent.last_name
            } : null,

            // حذف محتوای خام
            contents: undefined
        };
    }

    private buildBuyAdOrderBy(sortBy: string): any {
        const orderByMap = {
            'newest': { created_at: 'desc' },
            'oldest': { created_at: 'asc' },
            'most_offers': { total_offers: 'desc' },
            'least_offers': { total_offers: 'asc' },
            'urgent': { expires_at: 'asc' },
            'amount_high': { requirement_amount: 'desc' },
            'amount_low': { requirement_amount: 'asc' }
        };

        return orderByMap[sortBy] || orderByMap['newest'];
    }

    private async checkBuyAdAccess(buyAdId: string, userId: string): Promise<boolean> {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id: buyAdId },
            select: { user_id: true, account_id: true }
        });

        if (!buyAd) return false;

        if (buyAd.user_id === userId) {
            return true;
        }

        const accountUser = await this.prisma.accountUser.findUnique({
            where: {
                user_id_account_id: {
                    user_id: userId,
                    account_id: buyAd.account_id,
                }
            }
        });

        return !!accountUser;
    }

    private async canUserMakeOffer(buyAd: any, userId: string): Promise<boolean> {
        // کاربر نمی‌تواند به درخواست خودش پیشنهاد دهد
        if (buyAd.user_id === userId) {
            return false;
        }

        // اگر اجازه پیشنهاد عمومی وجود ندارد
        if (!buyAd.allow_public_offers) {
            return false;
        }

        // بررسی شرایط فروشنده
        if (buyAd.min_seller_rating) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { rating: true }
            });

            if ((user?.rating || 0) < buyAd.min_seller_rating) {
                return false;
            }
        }

        return true;
    }

    private async clearBuyAdCaches(userId: string, accountId: string): Promise<void> {
        try {
            const patterns = [
                `user_buy_ads:${userId}:*`,
                `buy_ad_search:*`,
                `buy_ad:${accountId}:*`
            ];

            for (const pattern of patterns) {
                await this.clearPatternKeys(pattern);
            }
        } catch (error) {
            console.error('Error clearing buy ad caches:', error);
        }
    }

    private async clearPatternKeys(pattern: string): Promise<void> {
        try {
            const client = (this.cacheManager as any).store.getClient();
            if (client && typeof client.keys === 'function') {
                const keys = await new Promise<string[]>((resolve, reject) => {
                    client.keys(pattern, (err: any, result: string[]) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });

                if (keys.length > 0) {
                    await Promise.all(keys.map(key => this.cacheManager.del(key)));
                }
            }
        } catch (error) {
            console.warn(`Could not clear pattern ${pattern}:`, error.message);
        }
    }

    // ==================== سایر متدها (update, delete, etc.) ====================
    // در ادامه فایل buy-ad.service.ts

// ==================== بروزرسانی درخواست خرید ====================
    async update(id: string, updateBuyAdDto: UpdateBuyAdDto, userId: string, language: Language = Language.fa) {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        if (buyAd.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این درخواست را ندارید');
        }

        // فقط درخواست‌های DRAFT یا ACTIVE قابل ویرایش هستند
        // راه حل بهتر - تعریف آرایه با نوع مشخص
        const editableStatuses: BuyAdStatus[] = [BuyAdStatus.DRAFT, BuyAdStatus.APPROVED];

        if (!editableStatuses.includes(buyAd.status)) {
            throw new ConflictException('این درخواست خرید در وضعیتی نیست که قابل ویرایش باشد');
        }

        return this.prisma.$transaction(async (tx) => {
            // بروزرسانی درخواست خرید اصلی
            const updateData: any = {};

            // فقط فیلدهای مجاز برای بروزرسانی
            const allowedFields = [
                'requirement_amount', 'unit', 'type', 'location_level_1_id',
                'location_level_2_id', 'location_level_3_id', 'location_level_4_id',
                'allow_phone_contact', 'allow_message_contact', 'allow_public_offers',
                'min_seller_rating', 'required_certifications', 'preferred_payment_methods',
                'expires_at'
            ];

            allowedFields.forEach(field => {
                if (updateBuyAdDto[field] !== undefined) {
                    updateData[field] = updateBuyAdDto[field];
                }
            });

            const updatedBuyAd = await tx.buyAd.update({
                where: { id },
                data: updateData
            });

            // بروزرسانی محتوای چندزبانه
            if (updateBuyAdDto.contents && updateBuyAdDto.contents.length > 0) {
                for (const content of updateBuyAdDto.contents) {
                    await tx.buyAdContent.upsert({
                        where: {
                            buy_ad_id_language: {
                                buy_ad_id: id,
                                language: content.language
                            }
                        },
                        update: {
                            ...(content.name && { name: content.name }),
                            ...(content.description && { description: content.description }),
                            ...(content.category_name && { category_name: content.category_name }),
                            ...(content.subcategory_name && { subcategory_name: content.subcategory_name }),
                            ...(content.auto_translated !== undefined && { auto_translated: content.auto_translated })
                        },
                        create: {
                            buy_ad_id: id,
                            language: content.language,
                            name: content.name || `درخواست خرید ${id}`,
                            description: content.description,
                            category_name: content.category_name,
                            subcategory_name: content.subcategory_name,
                            auto_translated: content.auto_translated ?? true
                        }
                    });
                }
            }

            await this.clearBuyAdCaches(userId, buyAd.account_id);
            return this.enrichBuyAdWithContent(updatedBuyAd, language);
        });
    }

// ==================== حذف درخواست خرید ====================
    async remove(id: string, userId: string): Promise<{ success: boolean; message: string }> {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        offers: {
                            where: {
                                status: { in: [OfferStatus.PENDING, OfferStatus.COUNTERED] }
                            }
                        },
                        Conversation: true
                    }
                }
            }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        if (buyAd.user_id !== userId) {
            throw new ForbiddenException('شما اجازه حذف این درخواست را ندارید');
        }

        // بررسی محدودیت‌ها برای حذف
        if (buyAd._count.offers > 0) {
            throw new ConflictException('این درخواست خرید دارای پیشنهاد فعال است و نمی‌توان حذف شود');
        }

        if (buyAd._count.Conversation > 0) {
            throw new ConflictException('این درخواست خرید دارای مکالمه فعال است و نمی‌توان حذف شود');
        }

        await this.prisma.$transaction(async (tx) => {
            // حذف محتوای چندزبانه
            await tx.buyAdContent.deleteMany({
                where: { buy_ad_id: id }
            });

            // حذف درخواست خرید
            await tx.buyAd.delete({
                where: { id }
            });
        });

        await this.clearBuyAdCaches(userId, buyAd.account_id);
        return {
            success: true,
            message: 'درخواست خرید با موفقیت حذف شد'
        };
    }

// ==================== غیرفعال کردن درخواست خرید ====================
    async deactivate(id: string, userId: string, language: Language = Language.fa) {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        if (buyAd.user_id !== userId) {
            throw new ForbiddenException('شما اجازه غیرفعال کردن این درخواست را ندارید');
        }

        const updatedBuyAd = await this.prisma.buyAd.update({
            where: { id },
            data: {
                status: BuyAdStatus.CANCELLED,
                // همچنین تمام پیشنهادات فعال را رد کنیم
            },
            include: this.getBuyAdListInclude(language)
        });

        // رد کردن تمام پیشنهادات فعال
        await this.prisma.offer.updateMany({
            where: {
                buy_ad_id: id,
                status: { in: [OfferStatus.PENDING, OfferStatus.COUNTERED] }
            },
            data: { status: OfferStatus.REJECTED }
        });

        await this.clearBuyAdCaches(userId, buyAd.account_id);
        return this.enrichBuyAdWithContent(updatedBuyAd, language);
    }

// ==================== تمدید درخواست خرید ====================
    async extendExpiry(id: string, userId: string, additionalDays: number = 7) {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        if (buyAd.user_id !== userId) {
            throw new ForbiddenException('شما اجازه تمدید این درخواست را ندارید');
        }

        if (buyAd.status !== BuyAdStatus.APPROVED) {
            throw new ConflictException('فقط درخواست‌های تایید شده قابل تمدید هستند');
        }

        const newExpiry = new Date(buyAd.expires_at);
        newExpiry.setDate(newExpiry.getDate() + additionalDays);

        const updatedBuyAd = await this.prisma.buyAd.update({
            where: { id },
            data: {
                expires_at: newExpiry
            }
        });

        await this.clearBuyAdCaches(userId, buyAd.account_id);
        return updatedBuyAd;
    }

// ==================== تغییر وضعیت درخواست خرید ====================
    async updateStatus(id: string, status: BuyAdStatus, userId: string, language: Language = Language.fa) {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        if (buyAd.user_id !== userId) {
            throw new ForbiddenException('شما اجازه تغییر وضعیت این درخواست را ندارید');
        }

        // اعتبارسنجی انتقال وضعیت
        const validTransitions = {
            [BuyAdStatus.DRAFT]: [BuyAdStatus.APPROVED, BuyAdStatus.CANCELLED],
            [BuyAdStatus.PENDING]: [BuyAdStatus.APPROVED, BuyAdStatus.CANCELLED],
            [BuyAdStatus.APPROVED]: [BuyAdStatus.FULFILLED, BuyAdStatus.CANCELLED, BuyAdStatus.EXPIRED],
            [BuyAdStatus.FULFILLED]: [],
            [BuyAdStatus.CANCELLED]: [BuyAdStatus.APPROVED],
            [BuyAdStatus.EXPIRED]: [BuyAdStatus.APPROVED]
        };

        if (!validTransitions[buyAd.status]?.includes(status)) {
            throw new BadRequestException(`تغییر وضعیت از ${buyAd.status} به ${status} مجاز نیست`);
        }

        const updateData: any = { status };

        // اگر وضعیت به FULFILLED تغییر کرد، تاریخ تکمیل را تنظیم کن
        if (status === BuyAdStatus.FULFILLED) {
            updateData.fulfilled_at = new Date();
        }

        // اگر وضعیت به ACTIVE برگشت، تاریخ انقضا را تمدید کن
        if (status === BuyAdStatus.APPROVED && buyAd.status !== BuyAdStatus.APPROVED) {
            updateData.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        const updatedBuyAd = await this.prisma.buyAd.update({
            where: { id },
            data: updateData,
            include: this.getBuyAdListInclude(language)
        });

        await this.clearBuyAdCaches(userId, buyAd.account_id);
        return this.enrichBuyAdWithContent(updatedBuyAd, language);
    }

// ==================== دریافت درخواست‌های خرید کاربر ====================
    async findAllByUser(filters: {
        page?: number;
        limit?: number;
        status?: BuyAdStatus;
        type?: BuyAdType;
        search?: string;
        language?: Language;
    }, userId: string) {
        const {
            page = 1,
            limit = 10,
            status,
            type,
            search,
            language = Language.fa
        } = filters;

        const skip = (page - 1) * limit;

        const where: Prisma.BuyAdWhereInput = { user_id: userId };

        // فیلترها
        if (status) where.status = status;
        if (type) where.type = type;

        // فیلتر جستجو در محتوای چندزبانه
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
                }
            ];
        }

        const [buyAds, total] = await Promise.all([
            this.prisma.buyAd.findMany({
                where,
                skip,
                take: limit,
                include: this.getBuyAdListInclude(language),
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.buyAd.count({ where }),
        ]);

        const enrichedBuyAds = buyAds.map(buyAd =>
            this.enrichBuyAdWithContent(buyAd, language)
        );

        return {
            buy_ads: enrichedBuyAds,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

// ==================== آمار و گزارشات پیشرفته ====================
    async getBuyAdStats(userId: string, timeframe: string = '30d') {
        const dateRange = this.calculateDateRange(timeframe);

        const [
            totalBuyAds,
            statusBreakdown,
            typeBreakdown,
            activeBuyAds,
            totalOffersReceived,
            totalConversations,
            recentActivity
        ] = await Promise.all([
            // کل درخواست‌ها
            this.prisma.buyAd.count({
                where: {
                    user_id: userId,
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                }
            }),

            // breakdown بر اساس وضعیت
            this.prisma.buyAd.groupBy({
                by: ['status'],
                where: {
                    user_id: userId,
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                },
                _count: true
            }),

            // breakdown بر اساس نوع
            this.prisma.buyAd.groupBy({
                by: ['type'],
                where: {
                    user_id: userId,
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                },
                _count: true
            }),

            // درخواست‌های فعال
            this.prisma.buyAd.count({
                where: {
                    user_id: userId,
                    status: BuyAdStatus.APPROVED,
                    expires_at: { gt: new Date() }
                }
            }),

            // کل پیشنهادات دریافتی
            this.prisma.offer.count({
                where: {
                    buy_ad: {
                        user_id: userId,
                        created_at: {
                            gte: dateRange.start,
                            lte: dateRange.end
                        }
                    }
                }
            }),

            // کل مکالمات
            this.prisma.conversation.count({
                where: {
                    OR: [
                        { user1_id: userId },
                        { user2_id: userId }
                    ],
                    buy_ad_id: { not: null },
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                }
            }),

            // فعالیت اخیر
            this.prisma.buyAd.findMany({
                where: {
                    user_id: userId,
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                },
                take: 5,
                orderBy: { created_at: 'desc' },
                include: {
                    contents: {
                        where: { language: Language.fa },
                        select: { name: true }
                    },
                    _count: {
                        select: {
                            offers: true,
                            Conversation: true
                        }
                    }
                }
            })
        ]);

        return {
            overview: {
                total_buy_ads: totalBuyAds,
                active_buy_ads: activeBuyAds,
                total_offers_received: totalOffersReceived,
                total_conversations: totalConversations,
                timeframe: this.getTimePeriodLabel(dateRange.start, dateRange.end)
            },
            breakdown: {
                by_status: statusBreakdown.reduce((acc, item) => {
                    acc[item.status] = item._count;
                    return acc;
                }, {}),
                by_type: typeBreakdown.reduce((acc, item) => {
                    acc[item.type] = item._count;
                    return acc;
                }, {})
            },
            recent_activity: recentActivity.map(activity => ({
                id: activity.id,
                name: activity.contents[0]?.name,
                status: activity.status,
                type: activity.type,
                created_at: activity.created_at,
                stats: {
                    offers: activity._count.offers,
                    conversations: activity._count.Conversation
                }
            })),
            insights: this.generateBuyAdInsights(statusBreakdown, totalOffersReceived, activeBuyAds)
        };
    }

// ==================== مدیریت محتوای چندزبانه ====================
    async updateBuyAdContent(buyAdId: string, contents: {
        language: Language;
        name?: string;
        description?: string;
        category_name?: string;
        subcategory_name?: string;
        auto_translated?: boolean;
    }[], userId: string): Promise<void> {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id: buyAdId }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        if (buyAd.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این درخواست را ندارید');
        }

        await this.prisma.$transaction(async (tx) => {
            for (const content of contents) {
                await tx.buyAdContent.upsert({
                    where: {
                        buy_ad_id_language: {
                            buy_ad_id: buyAdId,
                            language: content.language
                        }
                    },
                    update: {
                        ...(content.name && { name: content.name }),
                        ...(content.description && { description: content.description }),
                        ...(content.category_name && { category_name: content.category_name }),
                        ...(content.subcategory_name && { subcategory_name: content.subcategory_name }),
                        ...(content.auto_translated !== undefined && { auto_translated: content.auto_translated })
                    },
                    create: {
                        buy_ad_id: buyAdId,
                        language: content.language,
                        name: content.name || `درخواست خرید ${buyAdId}`,
                        description: content.description,
                        category_name: content.category_name,
                        subcategory_name: content.subcategory_name,
                        auto_translated: content.auto_translated ?? true
                    }
                });
            }
        });

        await this.clearBuyAdCaches(userId, buyAd.account_id);
    }

// ==================== متدهای کمکی اضافی ====================

    private calculateDateRange(timeframe: string): { start: Date; end: Date } {
        const end = new Date();
        const start = new Date();

        switch (timeframe) {
            case '7d':
                start.setDate(end.getDate() - 7);
                break;
            case '30d':
                start.setDate(end.getDate() - 30);
                break;
            case '90d':
                start.setDate(end.getDate() - 90);
                break;
            case '1y':
                start.setFullYear(end.getFullYear() - 1);
                break;
            default:
                start.setDate(end.getDate() - 30);
        }

        return { start, end };
    }

    private getTimePeriodLabel(date_from: Date, date_to: Date): string {
        if (!date_from && !date_to) return 'all_time';
        if (date_from && date_to) return 'custom_range';
        if (date_from) return `from_${date_from.toISOString().split('T')[0]}`;
        return `until_${date_to.toISOString().split('T')[0]}`;
    }

    private generateBuyAdInsights(statusBreakdown: any[], totalOffers: number, activeBuyAds: number): string[] {
        const insights: string[] = [];

        const activeCount = statusBreakdown.find(s => s.status === BuyAdStatus.APPROVED)?._count || 0;
        const fulfilledCount = statusBreakdown.find(s => s.status === BuyAdStatus.FULFILLED)?._count || 0;

        if (activeCount > 0) {
            const offersPerAd = totalOffers / activeCount;
            if (offersPerAd < 1) {
                insights.push('میانگین پیشنهادات دریافتی برای هر درخواست خرید پایین است. ممکن است نیاز به بهبود توضیحات یا شرایط داشته باشید');
            } else if (offersPerAd > 5) {
                insights.push('درخواست‌های خرید شما توجه زیادی جلب کرده‌اند! این نشان‌دهنده محبوبیت نیازهای شماست');
            }
        }

        if (fulfilledCount > 0 && activeCount === 0) {
            insights.push('تمام درخواست‌های خرید شما تکمیل شده‌اند. می‌توانید درخواست‌های جدید ایجاد کنید');
        }

        if (activeBuyAds > 10) {
            insights.push('تعداد درخواست‌های خرید فعال شما زیاد است. ممکن است نیاز به اولویت‌بندی داشته باشید');
        }

        return insights.length > 0 ? insights : ['وضعیت درخواست‌های خرید شما مطلوب است'];
    }

// ==================== بررسی انقضای خودکار ====================
    async checkAndExpireBuyAds(): Promise<{ expired: number }> {
        const result = await this.prisma.buyAd.updateMany({
            where: {
                status: BuyAdStatus.APPROVED,
                expires_at: { lt: new Date() }
            },
            data: {
                status: BuyAdStatus.EXPIRED
            }
        });

        // پاکسازی کش‌های مربوطه
        if (result.count > 0) {
            await this.clearPatternKeys('buy_ad_search:*');
            await this.clearPatternKeys('user_buy_ads:*');
        }

        return { expired: result.count };
    }

    // در فایل buy-ad.service.ts - این متدها رو اضافه کن

// ==================== حذف اجباری درخواست خرید (ادمین) ====================
    async forceRemove(id: string, adminUserId: string): Promise<{ success: boolean; message: string }> {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        await this.prisma.$transaction(async (tx) => {
            // حذف محتوای چندزبانه
            await tx.buyAdContent.deleteMany({
                where: { buy_ad_id: id }
            });

            // حذف پیشنهادات مرتبط
            await tx.offer.deleteMany({
                where: { buy_ad_id: id }
            });

            // حذف مکالمات مرتبط
            await tx.conversation.deleteMany({
                where: { buy_ad_id: id }
            });

            // حذف درخواست خرید
            await tx.buyAd.delete({
                where: { id }
            });
        });

        await this.clearBuyAdCaches(buyAd.user_id, buyAd.account_id);
        return {
            success: true,
            message: 'درخواست خرید با موفقیت حذف شد'
        };
    }

// ==================== آمار و گزارشات مدیریتی ====================
    async getAdminStats(timeframe: string = '30d', status?: BuyAdStatus, type?: BuyAdType) {
        const dateRange = this.calculateDateRange(timeframe);

        const where: Prisma.BuyAdWhereInput = {
            created_at: {
                gte: dateRange.start,
                lte: dateRange.end
            }
        };

        if (status) where.status = status;
        if (type) where.type = type;

        const [
            totalBuyAds,
            statusBreakdown,
            typeBreakdown,
            activeBuyAds,
            expiredBuyAds,
            totalOffers,
            totalConversations,
            topUsers,
            recentActivity
        ] = await Promise.all([
            // کل درخواست‌ها
            this.prisma.buyAd.count({ where }),

            // breakdown بر اساس وضعیت
            this.prisma.buyAd.groupBy({
                by: ['status'],
                where,
                _count: true
            }),

            // breakdown بر اساس نوع
            this.prisma.buyAd.groupBy({
                by: ['type'],
                where,
                _count: true
            }),

            // درخواست‌های فعال
            this.prisma.buyAd.count({
                where: {
                    ...where,
                    status: BuyAdStatus.APPROVED,
                    expires_at: { gt: new Date() }
                }
            }),

            // درخواست‌های منقضی شده
            this.prisma.buyAd.count({
                where: {
                    ...where,
                    status: BuyAdStatus.EXPIRED
                }
            }),

            // کل پیشنهادات
            this.prisma.offer.count({
                where: {
                    buy_ad: where
                }
            }),

            // کل مکالمات
            this.prisma.conversation.count({
                where: {
                    buy_ad_id: { not: null },
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                }
            }),

            // کاربران برتر
            this.prisma.buyAd.groupBy({
                by: ['user_id'],
                where,
                _count: {
                    id: true
                },
                orderBy: {
                    _count: {
                        id: 'desc'
                    }
                },
                take: 10
            }),

            // فعالیت اخیر
            this.prisma.buyAd.findMany({
                where,
                take: 10,
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language: Language.fa },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    contents: {
                        where: { language: Language.fa },
                        select: { name: true }
                    },
                    _count: {
                        select: {
                            offers: true,
                            Conversation: true
                        }
                    }
                }
            })
        ]);

        return {
            overview: {
                total_buy_ads: totalBuyAds,
                active_buy_ads: activeBuyAds,
                expired_buy_ads: expiredBuyAds,
                total_offers: totalOffers,
                total_conversations: totalConversations,
                timeframe: this.getTimePeriodLabel(dateRange.start, dateRange.end)
            },
            breakdown: {
                by_status: statusBreakdown.reduce((acc, item) => {
                    acc[item.status] = item._count;
                    return acc;
                }, {}),
                by_type: typeBreakdown.reduce((acc, item) => {
                    acc[item.type] = item._count;
                    return acc;
                }, {})
            },
            top_users: await Promise.all(
                topUsers.map(async (user) => {
                    const userDetails = await this.prisma.user.findUnique({
                        where: { id: user.user_id },
                        select: {
                            user_name: true,
                            contents: {
                                where: { language: Language.fa },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    });

                    return {
                        user_id: user.user_id,
                        user_name: userDetails?.user_name,
                        full_name: userDetails?.contents[0] ?
                            `${userDetails.contents[0].first_name} ${userDetails.contents[0].last_name}`.trim() :
                            null,
                        buy_ad_count: user._count.id
                    };
                })
            ),
            recent_activity: recentActivity.map(activity => ({
                id: activity.id,
                name: activity.contents[0]?.name,
                status: activity.status,
                type: activity.type,
                user: activity.user ? {
                    id: activity.user.id,
                    user_name: activity.user.user_name,
                    full_name: activity.user.contents[0] ?
                        `${activity.user.contents[0].first_name} ${activity.user.contents[0].last_name}`.trim() :
                        activity.user.user_name
                } : null,
                created_at: activity.created_at,
                stats: {
                    offers: activity._count.offers,
                    conversations: activity._count.Conversation
                }
            })),
            insights: this.generateAdminInsights(statusBreakdown, totalOffers, activeBuyAds)
        };
    }

// ==================== دریافت درخواست‌های خرید مشکل‌دار ====================
    async getProblematicBuyAds(page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        // درخواست‌های مشکل‌دار: منقضی شده اما فعال، بدون پیشنهاد، کاربران مسدود شده و...
        const where: Prisma.BuyAdWhereInput = {
            OR: [
                // درخواست‌های فعال اما منقضی شده
                {
                    status: BuyAdStatus.APPROVED,
                    expires_at: { lt: new Date() }
                },
                // درخواست‌های بدون پیشنهاد برای مدت طولانی
                {
                    status: BuyAdStatus.APPROVED,
                    created_at: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // بیش از 7 روز
                    offers: { none: {} }
                },
                // درخواست‌های کاربران مسدود شده
                {
                    user: {
                        is_blocked: true
                    }
                }
            ]
        };

        const [problematicBuyAds, total] = await Promise.all([
            this.prisma.buyAd.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            user_name: true,
                            is_blocked: true,
                            contents: {
                                where: { language: Language.fa },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    contents: {
                        where: { language: Language.fa },
                        select: { name: true, description: true }
                    },
                    _count: {
                        select: {
                            offers: true,
                            Conversation: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            }),
            this.prisma.buyAd.count({ where })
        ]);

        const processedBuyAds = problematicBuyAds.map(buyAd => {
            let problemType = '';
            let problemDescription = '';

            if (buyAd.status === BuyAdStatus.APPROVED && buyAd.expires_at < new Date()) {
                problemType = 'EXPIRED_BUT_ACTIVE';
                problemDescription = 'درخواست فعال اما منقضی شده';
            } else if (buyAd._count.offers === 0 &&
                buyAd.created_at < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
                problemType = 'NO_OFFERS_LONG_TIME';
                problemDescription = 'بدون پیشنهاد برای بیش از 7 روز';
            } else if (buyAd.user?.is_blocked) {
                problemType = 'USER_BLOCKED';
                problemDescription = 'کاربر ایجاد کننده مسدود شده';
            }

            return {
                ...buyAd,
                problem_type: problemType,
                problem_description: problemDescription,
                user: buyAd.user ? {
                    ...buyAd.user,
                    full_name: buyAd.user.contents[0] ?
                        `${buyAd.user.contents[0].first_name} ${buyAd.user.contents[0].last_name}`.trim() :
                        buyAd.user.user_name
                } : null
            };
        });

        return {
            problematic_buy_ads: processedBuyAds,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            summary: {
                expired_but_active: await this.prisma.buyAd.count({
                    where: {
                        status: BuyAdStatus.APPROVED,
                        expires_at: { lt: new Date() }
                    }
                }),
                no_offers_long_time: await this.prisma.buyAd.count({
                    where: {
                        status: BuyAdStatus.APPROVED,
                        created_at: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                        offers: { none: {} }
                    }
                }),
                blocked_users: await this.prisma.buyAd.count({
                    where: {
                        user: {
                            is_blocked: true
                        }
                    }
                })
            }
        };
    }

// ==================== متدهای کمکی اضافی برای ادمین ====================

    private generateAdminInsights(statusBreakdown: any[], totalOffers: number, activeBuyAds: number): string[] {
        const insights: string[] = [];

        const activeCount = statusBreakdown.find(s => s.status === BuyAdStatus.APPROVED)?._count || 0;
        const expiredCount = statusBreakdown.find(s => s.status === BuyAdStatus.EXPIRED)?._count || 0;

        if (expiredCount > activeCount * 0.3) {
            insights.push('تعداد درخواست‌های منقضی شده زیاد است. ممکن است نیاز به تمدید خودکار یا اطلاع‌رسانی بهتر باشد');
        }

        if (activeCount > 0) {
            const offersPerAd = totalOffers / activeCount;
            if (offersPerAd < 0.5) {
                insights.push('میانگین پیشنهادات برای هر درخواست خرید پایین است. ممکن است نیاز به بهبود سیستم پیشنهادات باشد');
            }
        }

        if (activeBuyAds > 100) {
            insights.push('تعداد درخواست‌های خرید فعال زیاد است. سیستم به خوبی در حال استفاده است');
        }

        const blockedUsersCount = statusBreakdown.find(s => s.status === BuyAdStatus.CANCELLED)?._count || 0;
        if (blockedUsersCount > 10) {
            insights.push('تعداد درخواست‌های لغو شده زیاد است. ممکن است نیاز به بررسی دلایل لغو باشد');
        }

        return insights.length > 0 ? insights : ['وضعیت کلی درخواست‌های خرید مطلوب است'];
    }
}