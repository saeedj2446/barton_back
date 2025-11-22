// src/services/product/ProductAdminService.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    PrismaClient,
    ProductStatus,
    Language,
    SystemRole,
    Prisma,
    FileUsage,
    Product,
    AccountActivityType
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import {ProductBaseService} from "./product.base.service";
import {ExcelColumn, ExcelService, ExportConfig} from "../../common/services/excel-service";
import {PrismaService} from "../../prisma/prisma.service";


@Injectable()
export class ProductAdminService extends ProductBaseService {
    constructor(
        protected prisma: PrismaService,
        @Inject(CACHE_MANAGER) protected cacheManager: Cache,
        private readonly excelService: ExcelService
    ) {
        super(prisma, cacheManager); // ارسال prisma به parent
    }


    // ==================== دریافت محصولات برای بررسی مدیریتی ====================
    async getProductsForReview(options: {
        page?: number;
        limit?: number;
        status?: ProductStatus[];
        search?: string;
        category_id?: string;
        account_id?: string;
        user_id?: string;
        date_from?: Date;
        date_to?: Date;
        sort_by?: string;
        language?: Language;
    } = {}): Promise<{ products: any[]; total: number; page: number; totalPages: number; stats: any }> {
        const {
            page = 1,
            limit = 20,
            status = [ProductStatus.PENDING, ProductStatus.EDIT_PENDING],
            search,
            category_id,
            account_id,
            user_id,
            date_from,
            date_to,
            sort_by = 'oldest',
            language = Language.fa
        } = options;

        const where: Prisma.ProductWhereInput = {
            status: { in: status }
        };

        // فیلتر تاریخ
        if (date_from || date_to) {
            where.created_at = {};
            if (date_from) where.created_at.gte = date_from;
            if (date_to) where.created_at.lte = date_to;
        }

        // فیلتر جستجو
        if (search) {
            where.OR = [
                {
                    contents: {
                        some: {
                            name: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
                {
                    contents: {
                        some: {
                            description: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
                {
                    user: {
                        contents: {
                            some: {
                                OR: [
                                    { first_name: { contains: search, mode: 'insensitive' } },
                                    { last_name: { contains: search, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }
                },
                {
                    account: {
                        contents: {
                            some: {
                                OR: [
                                    { name: { contains: search, mode: 'insensitive' } },
                                    { company_name: { contains: search, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }
                }
            ];
        }

        // فیلترهای دیگر
        if (category_id) where.category_id = category_id;
        if (account_id) where.account_id = account_id;
        if (user_id) where.user_id = user_id;

        const orderBy = this.buildAdminOrderBy(sort_by);
        const skip = (page - 1) * limit;

        try {
            const [products, total, stats] = await Promise.all([
                this.prisma.product.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getAdminProductInclude(language),
                    orderBy,
                }),
                this.prisma.product.count({ where }),
                this.getReviewStats(where)
            ]);

            const enrichedProducts = products.map(product =>
                this.enrichAdminProduct(product, language)
            );

            return {
                products: enrichedProducts,
                total,
                page,
                totalPages: Math.ceil(total / limit),
                stats
            };
        } catch (error) {
            console.error('Error in getProductsForReview:', error);
            throw error;
        }
    }

    // ==================== تایید محصول ====================
    async approveProduct(productId: string, adminUserId: string, options: {
        notes?: string;
        auto_boost?: boolean;
        boost_power?: number;
        language?: Language;
    } = {}): Promise<{ product: any; action: string }> {
        const {
            notes,
            auto_boost = false,
            boost_power = 1,
            language = Language.fa
        } = options;

        return this.prisma.$transaction(async (tx) => {
            // بررسی وجود محصول
            const product = await tx.product.findUnique({
                where: { id: productId },
                include: {
                    user: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true },
                                take: 1
                            }
                        }
                    },
                    account: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { name: true, company_name: true },
                                take: 1
                            }
                        }
                    }
                }
            });

            if (!product) {
                throw new NotFoundException('محصول یافت نشد');
            }

            if (product.status === ProductStatus.APPROVED) {
                throw new BadRequestException('محصول قبلاً تایید شده است');
            }

            // تایید محصول
            const updateData: any = {
                status: ProductStatus.APPROVED,
                confirmed: true,
                confirmed_at: new Date(),
                confirmed_by: adminUserId
            };

            // بوست خودکار اگر درخواست شده
            if (auto_boost) {
                const boostExpiresAt = new Date();
                boostExpiresAt.setDate(boostExpiresAt.getDate() + 7); // 7 روز

                updateData.boost_purchased = true;
                updateData.boost_power = boost_power;
                updateData.boost_expires_at = boostExpiresAt;
                updateData.boost_is_elevated = true;
            }

            const updatedProduct = await tx.product.update({
                where: { id: productId },
                data: updateData,
                include: this.getAdminProductInclude(language)
            });

            // ثبت لاگ مدیریتی
            await tx.accountUserActivity.create({
                data: {
                    account_user_id: adminUserId, // استفاده از ادمین به عنوان کاربر
                    activity_type: 'PROFILE_UPDATE',
                    target_type: 'PRODUCT',
                    target_id: productId,
                    product_id: productId,
                    metadata: {
                        action: 'product_approval',
                        previous_status: product.status,
                        new_status: ProductStatus.APPROVED,
                        notes: notes,
                        auto_boost: auto_boost,
                        boost_power: boost_power,
                        admin_user_id: adminUserId
                    },
                    weight: 5
                }
            });

            // ثبت تاریخچه تغییرات
            await tx.productAuditLog.create({
                data: {
                    product_id: productId,
                    user_id: adminUserId,
                    action: 'approve',
                    old_status: product.status,
                    new_status: ProductStatus.APPROVED,
                    notes: notes,
                    metadata: { auto_boost, boost_power }
                }
            });

            // پاکسازی کش
            await this.clearAdminCaches();

            return {
                product: this.enrichAdminProduct(updatedProduct, language),
                action: 'approved'
            };
        });
    }

    // ==================== رد محصول ====================
    async rejectProduct(productId: string, adminUserId: string, options: {
        reason: string;
        rejection_code?: string;
        allow_resubmit?: boolean;
        language?: Language;
    }): Promise<{ product: any; action: string }> {
        const {
            reason,
            rejection_code = 'GENERAL',
            allow_resubmit = true,
            language = Language.fa
        } = options;

        if (!reason || reason.trim().length < 10) {
            throw new BadRequestException('لطفاً دلیل رد محصول را به طور کامل توضیح دهید');
        }

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({
                where: { id: productId }
            });

            if (!product) {
                throw new NotFoundException('محصول یافت نشد');
            }

            if (product.status === ProductStatus.REJECTED) {
                throw new BadRequestException('محصول قبلاً رد شده است');
            }

            const updatedProduct = await tx.product.update({
                where: { id: productId },
                data: {
                    status: ProductStatus.REJECTED,
                    confirmed: false,
                    rejection_reason: reason,
                    rejection_code: rejection_code,
                    rejected_at: new Date(),
                    rejected_by: adminUserId,
                    ...(allow_resubmit && {
                        can_resubmit: true,
                        resubmit_after: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 ساعت بعد
                    })
                },
                include: this.getAdminProductInclude(language)
            });

            // ثبت لاگ مدیریتی
            await tx.accountUserActivity.create({
                data: {
                    account_user_id: adminUserId,
                    activity_type: 'PROFILE_UPDATE',
                    target_type: 'PRODUCT',
                    target_id: productId,
                    product_id: productId,
                    metadata: {
                        action: 'product_rejection',
                        previous_status: product.status,
                        new_status: ProductStatus.REJECTED,
                        reason: reason,
                        rejection_code: rejection_code,
                        allow_resubmit: allow_resubmit,
                        admin_user_id: adminUserId
                    },
                    weight: 5
                }
            });

            await this.clearAdminCaches();
// ثبت تاریخچه تغییرات
            await tx.productAuditLog.create({
                data: {
                    product_id: productId,
                    user_id: adminUserId,
                    action: 'reject',
                    old_status: product.status,
                    new_status: ProductStatus.REJECTED,
                    reason: reason,
                    notes: `کد رد: ${rejection_code}`
                }
            });
            return {
                product: this.enrichAdminProduct(updatedProduct, language),
                action: 'rejected'
            };
        });
    }

    // ==================== تعلیق محصول ====================
    async suspendProduct(productId: string, adminUserId: string, options: {
        reason: string;
        duration_days?: number;
        suspend_related_products?: boolean;
        language?: Language;
    }): Promise<{ product: any; action: string; affected_products?: number }> {
        const {
            reason,
            duration_days = 7,
            suspend_related_products = false,
            language = Language.fa
        } = options;

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({
                where: { id: productId },
                include: {
                    user: {
                        select: { id: true }
                    }
                }
            });

            if (!product) {
                throw new NotFoundException('محصول یافت نشد');
            }

            const suspendUntil = new Date();
            suspendUntil.setDate(suspendUntil.getDate() + duration_days);

            const updatedProduct = await tx.product.update({
                where: { id: productId },
                data: {
                    status: ProductStatus.SUSPENDED,
                    suspension_reason: reason,
                    suspended_at: new Date(),
                    suspended_by: adminUserId,
                    suspension_ends_at: suspendUntil
                },
                include: this.getAdminProductInclude(language)
            });

            let affectedCount = 0;

            // تعلیق محصولات مرتبط اگر درخواست شده
            if (suspend_related_products && product.user) {
                const result = await tx.product.updateMany({
                    where: {
                        user_id: product.user.id,
                        id: { not: productId },
                        status: { in: [ProductStatus.APPROVED, ProductStatus.PENDING] }
                    },
                    data: {
                        status: ProductStatus.SUSPENDED,
                        suspension_reason: `تعلیق دسته‌جمعی - ${reason}`,
                        suspended_at: new Date(),
                        suspended_by: adminUserId,
                        suspension_ends_at: suspendUntil
                    }
                });

                affectedCount = result.count;
            }

            // ثبت لاگ
            await tx.accountUserActivity.create({
                data: {
                    account_user_id: adminUserId,
                    activity_type: 'PROFILE_UPDATE',
                    target_type: 'PRODUCT',
                    target_id: productId,
                    product_id: productId,
                    metadata: {
                        action: 'product_suspension',
                        previous_status: product.status,
                        new_status: ProductStatus.SUSPENDED,
                        reason: reason,
                        duration_days: duration_days,
                        suspend_related: suspend_related_products,
                        affected_products: affectedCount,
                        admin_user_id: adminUserId
                    },
                    weight: 5
                }
            });

            await this.clearAdminCaches();
// ثبت تاریخچه تغییرات
            await tx.productAuditLog.create({
                data: {
                    product_id: productId,
                    user_id: adminUserId,
                    action: 'suspend',
                    old_status: product.status,
                    new_status: ProductStatus.SUSPENDED,
                    reason: reason,
                    notes: `مدت تعلیق: ${duration_days} روز`
                }
            });
            return {
                product: this.enrichAdminProduct(updatedProduct, language),
                action: 'suspended',
                ...(affectedCount > 0 && { affected_products: affectedCount })
            };
        });
    }

    // ==================== فعال‌سازی مجدد محصول ====================
    async unsuspendProduct(productId: string, adminUserId: string, language: Language = Language.fa): Promise<{ product: any; action: string }> {
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({
                where: { id: productId }
            });

            if (!product) {
                throw new NotFoundException('محصول یافت نشد');
            }

            if (product.status !== ProductStatus.SUSPENDED) {
                throw new BadRequestException('محصول در حالت تعلیق نیست');
            }

            const updatedProduct = await tx.product.update({
                where: { id: productId },
                data: {
                    status: ProductStatus.APPROVED,
                    suspension_reason: null,
                    suspended_at: null,
                    suspended_by: null,
                    suspension_ends_at: null
                },
                include: this.getAdminProductInclude(language)
            });

            // ثبت لاگ
            await tx.accountUserActivity.create({
                data: {
                    account_user_id: adminUserId,
                    activity_type: 'PROFILE_UPDATE',
                    target_type: 'PRODUCT',
                    target_id: productId,
                    product_id: productId,
                    metadata: {
                        action: 'product_unsuspension',
                        previous_status: ProductStatus.SUSPENDED,
                        new_status: ProductStatus.APPROVED,
                        admin_user_id: adminUserId
                    },
                    weight: 5
                }
            });

            await this.clearAdminCaches();
// ثبت تاریخچه محصولات
            await tx.productAuditLog.create({
                data: {
                    product_id: productId,
                    user_id: adminUserId,
                    action: 'unsuspend',
                    old_status: ProductStatus.SUSPENDED,
                    new_status: ProductStatus.APPROVED,
                    notes: 'فعال‌سازی مجدد محصول'
                }
            });
            return {
                product: this.enrichAdminProduct(updatedProduct, language),
                action: 'unsuspended'
            };
        });
    }

    // ==================== مدیریت دسته‌جمعی محصولات ====================
    async bulkUpdateProducts(productIds: string[], action: string, adminUserId: string, options: {
        status?: ProductStatus;
        reason?: string;
        category_id?: string;
        language?: Language;
    } = {}): Promise<{ updated: number; failed: number; details: any }> {
        const {
            status,
            reason,
            category_id,
            language = Language.fa
        } = options;

        if (!productIds || productIds.length === 0) {
            throw new BadRequestException('لیست محصولات نمی‌تواند خالی باشد');
        }

        if (productIds.length > 100) {
            throw new BadRequestException('حداکثر 100 محصول در هر عملیات مجاز است');
        }

        let updatedCount = 0;
        const failedUpdates: { productId: string; error: string }[] = [];

        for (const productId of productIds) {
            try {
                switch (action) {
                    case 'approve':
                        await this.approveProduct(productId, adminUserId, { language });
                        updatedCount++;
                        break;

                    case 'reject':
                        if (!reason) {
                            throw new BadRequestException('برای رد محصولات، دلیل الزامی است');
                        }
                        await this.rejectProduct(productId, adminUserId, { reason, language });
                        updatedCount++;
                        break;

                    case 'suspend':
                        if (!reason) {
                            throw new BadRequestException('برای تعلیق محصولات، دلیل الزامی است');
                        }
                        await this.suspendProduct(productId, adminUserId, { reason, language });
                        updatedCount++;
                        break;

                    case 'unsuspend':
                        await this.unsuspendProduct(productId, adminUserId, language);
                        updatedCount++;
                        break;

                    case 'change_category':
                        if (!category_id) {
                            throw new BadRequestException('برای تغییر دسته‌بندی، شناسه دسته‌بندی جدید الزامی است');
                        }
                        await this.changeProductCategory(productId, category_id, adminUserId, language);
                        updatedCount++;
                        break;

                    default:
                        throw new BadRequestException(`عملیات '${action}' پشتیبانی نمی‌شود`);
                }
            } catch (error) {
                failedUpdates.push({
                    productId,
                    error: error.message
                });
            }
        }

        await this.clearAdminCaches();

        return {
            updated: updatedCount,
            failed: failedUpdates.length,
            details: {
                action,
                total_attempted: productIds.length,
                failed_updates: failedUpdates
            }
        };
    }

    // ==================== آمار و گزارشات مدیریتی ====================
    async getAdminStats(options: {
        date_from?: Date;
        date_to?: Date;
        category_id?: string;
        account_activity_type?: AccountActivityType;
        language?: Language;
    } = {}): Promise<any> {
        const {
            date_from,
            date_to,
            category_id,
            account_activity_type,
            language = Language.fa
        } = options;

        const dateFilter = this.buildDateFilter(date_from, date_to);

        try {
            const [
                totalProducts,
                statusBreakdown,
                dailyApprovals,
                categoryStats,
                accountTypeStats,
                moderatorActivity,
                avgProcessingTime
            ] = await Promise.all([
                // کل محصولات
                this.prisma.product.count({
                    where: { ...dateFilter }
                }),

                // breakdown بر اساس وضعیت
                this.prisma.product.groupBy({
                    by: ['status'],
                    where: { ...dateFilter },
                    _count: true
                }),

                // تاییدهای روزانه
                this.getDailyApprovals(date_from, date_to),

                // آمار دسته‌بندی
                this.getCategoryStats(dateFilter, category_id, language),

                // آمار نوع حساب
                this.getAccountTypeStats(dateFilter, account_activity_type),

                // فعالیت مودریتورها
                this.getModeratorActivity(date_from, date_to),

                // میانگین زمان پردازش
                this.getAverageProcessingTime(date_from, date_to)
            ]);

            return {
                overview: {
                    total_products: totalProducts,
                    time_period: this.getTimePeriodLabel(date_from, date_to)
                },
                status_breakdown: this.formatStatusBreakdown(statusBreakdown),
                approval_metrics: {
                    daily_approvals: dailyApprovals,
                    average_processing_time_hours: avgProcessingTime
                },
                category_analysis: categoryStats,
                account_analysis: accountTypeStats,
                moderator_performance: moderatorActivity,
                recommendations: this.generateAdminRecommendations(
                    statusBreakdown,
                    avgProcessingTime,
                    dailyApprovals
                )
            };
        } catch (error) {
            console.error('Error in getAdminStats:', error);
            throw error;
        }
    }

    // ==================== جستجوی پیشرفته مدیریتی ====================
    // ==================== جستجوی پیشرفته مدیریتی ====================
    // ==================== جستجوی پیشرفته مدیریتی ====================
    async adminSearchProducts(filters: {
        query?: string;
        status?: ProductStatus[];
        category_id?: string;
        account_id?: string;
        user_id?: string;
        has_images?: boolean;
        has_video?: boolean;
        price_min?: number;
        price_max?: number;
        stock_min?: number;
        stock_max?: number;
        boost_active?: boolean;
        date_from?: Date;
        date_to?: Date;
        sort_by?: string;
        page?: number;
        limit?: number;
        language?: Language;
    }): Promise<{ products: any[]; total: number; page: number; totalPages: number }> {
        const {
            query,
            status,
            category_id,
            account_id,
            user_id,
            has_images,
            has_video,
            price_min,
            price_max,
            stock_min,
            stock_max,
            boost_active,
            date_from,
            date_to,
            sort_by = 'recent',
            page = 1,
            limit = 50,
            language = Language.fa
        } = filters;

        const where: Prisma.ProductWhereInput = {};

        // فیلتر وضعیت
        if (status && status.length > 0) {
            where.status = { in: status };
        }

        // فیلتر تاریخ
        if (date_from || date_to) {
            where.created_at = {};
            if (date_from) where.created_at.gte = date_from;
            if (date_to) where.created_at.lte = date_to;
        }

        // فیلترهای پایه
        if (category_id) where.category_id = category_id;
        if (account_id) where.account_id = account_id;
        if (user_id) where.user_id = user_id;

        // فیلتر تصاویر - استفاده از join با File
        if (has_images !== undefined) {
            where.files = has_images ?
                { some: { file_usage: FileUsage.PRODUCT_IMAGE } } :
                { none: { file_usage: FileUsage.PRODUCT_IMAGE } };
        }

        // فیلتر ویدئو - استفاده از join با File برای بررسی نوع فایل
        if (has_video !== undefined) {
            where.files = {
                ...(where.files as any), // حفظ فیلترهای قبلی اگر وجود داشت
                ...(has_video ?
                        { some: { file_usage: FileUsage.PRODUCT_VIDEO } } :
                        { none: { file_usage: FileUsage.PRODUCT_VIDEO } }
                )
            };
        }

        // فیلتر قیمت - استفاده از join با ProductPrice
        if (price_min !== undefined || price_max !== undefined) {
            where.pricing_strategies = {
                some: {
                    is_active: true,
                    is_primary: true,
                    final_price_amount: {
                        ...(price_min !== undefined && { gte: price_min }),
                        ...(price_max !== undefined && { lte: price_max })
                    }
                }
            };
        }

        // فیلتر موجودی
        if (stock_min !== undefined || stock_max !== undefined) {
            where.stock = {};
            if (stock_min !== undefined) where.stock.gte = stock_min;
            if (stock_max !== undefined) where.stock.lte = stock_max;
        }

        // فیلتر بوست
        if (boost_active !== undefined) {
            if (boost_active) {
                where.boost_purchased = true;
                where.boost_expires_at = { gt: new Date() };
            } else {
                where.OR = [
                    { boost_purchased: false },
                    { boost_expires_at: { lt: new Date() } }
                ];
            }
        }

        // فیلتر جستجوی پیشرفته
        if (query) {
            where.OR = [
                {
                    contents: {
                        some: {
                            OR: [
                                { name: { contains: query, mode: 'insensitive' } },
                                { description: { contains: query, mode: 'insensitive' } },
                                { brand_name: { contains: query, mode: 'insensitive' } }
                            ]
                        }
                    }
                },
                {
                    user: {
                        OR: [
                            { user_name: { contains: query, mode: 'insensitive' } },
                            {
                                contents: {
                                    some: {
                                        OR: [
                                            { first_name: { contains: query, mode: 'insensitive' } },
                                            { last_name: { contains: query, mode: 'insensitive' } }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                },
                {
                    account: {
                        contents: {
                            some: {
                                OR: [
                                    { name: { contains: query, mode: 'insensitive' } },
                                    { company_name: { contains: query, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }
                },
                { id: { contains: query, mode: 'insensitive' } }
            ];
        }

        const orderBy = this.buildAdminSearchOrderBy(sort_by);
        const skip = (page - 1) * limit;

        try {
            const [products, total] = await Promise.all([
                this.prisma.product.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        account: {
                            select: {
                                id: true,
                                activity_type: true,
                                profile_photo: true,
                                confirmed: true,
                                is_active: true,
                                contents: {
                                    where: { language },
                                    select: {
                                        name: true,
                                        company_name: true,
                                        description: true
                                    }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                user_name: true,
                                mobile: true,
                                is_verified: true,
                                is_blocked: true,
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
                                brand_name: true,
                                category_name: true
                            }
                        },
                        category: {
                            select: {
                                id: true,
                                contents: {
                                    where: { language },
                                    select: { name: true }
                                }
                            }
                        },
                        files: {
                            where: {
                                file_usage: {
                                    in: [FileUsage.PRODUCT_IMAGE, FileUsage.PRODUCT_VIDEO]
                                }
                            },
                            select: {
                                id: true,
                                file_usage: true,
                                file_path: true,
                                thumbnail_path: true,
                            }
                        },
                        pricing_strategies: {
                            where: { is_active: true, is_primary: true },
                            take: 1,
                            select: {
                                final_price_amount: true,
                                price_unit: true,
                                has_discount: true
                            }
                        },
                        _count: {
                            select: {
                                reviews: true,
                                interactions: true,
                                files: true
                            }
                        }
                    },
                    orderBy,
                }),
                this.prisma.product.count({ where }),
            ]);

            const enrichedProducts = products.map(product =>
                this.enrichAdminProduct(product, language)
            );

            return {
                products: enrichedProducts,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('Error in adminSearchProducts:', error);
            throw error;
        }
    }

    // ==================== دریافت تاریخچه تغییرات محصول ====================

    async getProductAuditLog(productId: string, options: {
        page?: number;
        limit?: number;
        action_types?: string[];
        language?: Language;
    } = {}): Promise<{ logs: any[]; total: number; page: number; totalPages: number }> {

        const {
            page = 1,
            limit = 20,
            action_types,
            language = Language.fa
        } = options;

        const where: Prisma.ProductAuditLogWhereInput = {
            product_id: productId
        };

        if (action_types && action_types.length > 0) {
            where.action = { in: action_types };
        }

        const skip = (page - 1) * limit;

        try {
            const [logs, total] = await Promise.all([
                this.prisma.productAuditLog.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        user: {
                            select: {
                                id: true,
                                user_name: true,
                                contents: {
                                    where: { language },
                                    select: { first_name: true, last_name: true }
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' }
                }),
                this.prisma.productAuditLog.count({ where })
            ]);

            const enrichedLogs = logs.map(log => {
                // مشخص کردن نوع برای userContent
                const userContent = log.user.contents?.[0] as { first_name?: string; last_name?: string } || {};
                const firstName = userContent.first_name || '';
                const lastName = userContent.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();

                return {
                    id: log.id,
                    action: log.action,
                    timestamp: log.created_at,
                    user: {
                        id: log.user.id,
                        user_name: log.user.user_name,
                        full_name: fullName || log.user.user_name
                    },
                    old_status: log.old_status,
                    new_status: log.new_status,
                    reason: log.reason,
                    notes: log.notes,
                    details: log.metadata
                };
            });

            return {
                logs: enrichedLogs,
                total,
                page,
                totalPages: Math.ceil(total / limit)  // ✅ حالا limit داریم
            };
        } catch (error) {
            console.error('Error in getProductAuditLog:', error);
            throw error;
        }
    }

    // ==================== متدهای کمکی ====================

    private getAdminProductInclude(language: Language) {
        return {
            account: {
                select: {
                    id: true,
                    name: true,
                    activity_type: true,
                    profile_photo: true,
                    confirmed: true,
                    is_active: true,
                    contents: {
                        where: { language },
                        select: { name: true, description: true }
                    }
                }
            },
            user: {
                select: {
                    id: true,
                    user_name: true,
                    mobile: true,
                    is_verified: true,
                    is_blocked: true,
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
                    brand_name: true,
                    category_name: true
                }
            },
            category: {
                select: {
                    id: true,
                    contents: {
                        where: { language },
                        select: { name: true }
                    }
                }
            },
            files: {
                where: { file_usage: FileUsage.PRODUCT_IMAGE },
                take: 1,
                select: {
                    id: true,
                    file_path: true,
                    thumbnail_path: true,
                }
            },
            pricing_strategies: {
                where: { is_active: true, is_primary: true },
                take: 1,
                select: {
                    final_price_amount: true,
                    price_unit: true,
                    has_discount: true
                }
            },
            _count: {
                select: {
                    reviews: true,
                    interactions: true,
                    files: true
                }
            }
        };
    }

    private enrichAdminProduct(product: any, language: Language) {
        const baseProduct = this.enrichPublicProduct(product, language);
        const userContent = product.user?.contents?.[0] || {};
        const accountContent = product.account?.contents?.[0] || {};

        return {
            ...baseProduct,

            // اطلاعات مدیریتی
            admin_info: {
                status: product.status,
                confirmed: product.confirmed,
                confirmed_at: product.confirmed_at,
                confirmed_by: product.confirmed_by,
                rejection_reason: product.rejection_reason,
                suspension_reason: product.suspension_reason,
                suspended_at: product.suspended_at,
                suspended_by: product.suspended_by,
                suspension_ends_at: product.suspension_ends_at,
                can_resubmit: product.can_resubmit,
                resubmit_after: product.resubmit_after
            },

            // اطلاعات کاربر
            user: {
                id: product.user?.id,
                user_name: product.user?.user_name,
                mobile: product.user?.mobile,
                full_name: `${userContent.first_name || ''} ${userContent.last_name || ''}`.trim(),
                is_verified: product.user?.is_verified,
                is_blocked: product.user?.is_blocked
            },

            // اطلاعات حساب
            account: {
                id: product.account?.id,
                name: accountContent.name || product.account?.name,
                activity_type: product.account?.activity_type,
                is_verified: product.account?.confirmed,
                is_active: product.account?.is_active
            },

            // آمار کامل
            detailed_stats: {
                ...baseProduct.stats,
                files: product._count?.files || 0,
                all_interactions: product._count?.interactions || 0
            },

            // اطلاعات فنی
            technical_info: {
                has_video: product.has_video,
                is_brands_representative: product.is_brands_representative,
                is_based_on_catalog: product.is_based_on_catalog,
                boost_power: product.boost_power,
                boost_expires_at: product.boost_expires_at,
                last_price_update: product.last_price_update
            }
        };
    }

    private buildAdminOrderBy(sortBy: string): any {
        const orderByMap = {
            'oldest': { created_at: 'asc' },
            'newest': { created_at: 'desc' },
            'status': { status: 'asc' },
            'user': { user: { user_name: 'asc' } },
            'account': { account: { name: 'asc' } },
            'category': { category: { contents: { name: 'asc' } } },
            'price_low': { calculated_min_price: 'asc' },
            'price_high': { calculated_min_price: 'desc' }
        };

        return orderByMap[sortBy] || orderByMap['oldest'];
    }

    private buildAdminSearchOrderBy(sortBy: string): any {
        const orderByMap = {
            'recent': { created_at: 'desc' },
            'oldest': { created_at: 'asc' },
            'status': [
                { status: 'asc' },
                { created_at: 'desc' }
            ],
            'popular': { total_views: 'desc' },
            'price_low': { calculated_min_price: 'asc' },
            'price_high': { calculated_min_price: 'desc' },
            'user': { user: { user_name: 'asc' } }
        };

        return orderByMap[sortBy] || orderByMap['recent'];
    }

    private async getReviewStats(where: Prisma.ProductWhereInput): Promise<any> {
        const [
            totalPending,
            totalEditPending,
            byCategory,
            byAccountType,
            avgProcessingTime
        ] = await Promise.all([
            this.prisma.product.count({
                where: { ...where, status: ProductStatus.PENDING }
            }),
            this.prisma.product.count({
                where: { ...where, status: ProductStatus.EDIT_PENDING }
            }),
            this.prisma.product.groupBy({
                by: ['category_id'],
                where,
                _count: true
            }),
            this.prisma.product.groupBy({
                by: ['account_id'],
                where,
                _count: true,
                _avg: {
                    base_min_price: true  // ✅ استفاده از فیلد موجود
                }
            }),
            this.calculateAverageProcessingTime(where)
        ]);

        return {
            total_pending: totalPending,
            total_edit_pending: totalEditPending,
            by_category: byCategory,
            by_account: byAccountType,
            avg_processing_time_hours: avgProcessingTime
        };
    }

    async changeProductCategory(productId: string, newCategoryId: string, adminUserId: string, language: Language): Promise<void> {
        await this.prisma.product.update({
            where: { id: productId },
            data: {
                category_id: newCategoryId,
                status: ProductStatus.EDIT_PENDING // نیاز به بررسی مجدد
            }
        });

        // ثبت در لاگ
        await this.prisma.accountUserActivity.create({
            data: {
                account_user_id: adminUserId,
                activity_type: 'PROFILE_UPDATE',
                target_type: 'PRODUCT',
                target_id: productId,
                product_id: productId,
                metadata: {
                    action: 'category_change',
                    new_category_id: newCategoryId,
                    admin_user_id: adminUserId
                },
                weight: 3
            }
        });
    }

    private buildDateFilter(date_from?: Date, date_to?: Date): any {
        if (!date_from && !date_to) return {};

        const filter: any = {};
        if (date_from) filter.gte = date_from;
        if (date_to) filter.lte = date_to;

        return { created_at: filter };
    }

    private async getDailyApprovals(date_from?: Date, date_to?: Date): Promise<any[]> {
        // پیاده‌سازی آمار تاییدهای روزانه
        return [];
    }

    private async getCategoryStats(dateFilter: any, category_id?: string, language?: Language): Promise<any[]> {
        // پیاده‌سازی آمار دسته‌بندی
        return [];
    }

    private async getAccountTypeStats(dateFilter: any, account_activity_type?: AccountActivityType): Promise<any[]> {
        // پیاده‌سازی آمار نوع حساب
        return [];
    }

    private async getModeratorActivity(date_from?: Date, date_to?: Date): Promise<any[]> {
        // پیاده‌سازی فعالیت مودریتورها
        return [];
    }

    private async getAverageProcessingTime(date_from?: Date, date_to?: Date): Promise<number> {
        // پیاده‌سازی میانگین زمان پردازش
        return 0;
    }

    private async calculateAverageProcessingTime(where: Prisma.ProductWhereInput): Promise<number> {
        // پیاده‌سازی محاسبه زمان پردازش
        return 0;
    }

    private formatStatusBreakdown(breakdown: any[]): any {
        return breakdown.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
        }, {});
    }

    private getTimePeriodLabel(date_from?: Date, date_to?: Date): string {
        if (!date_from && !date_to) return 'all_time';
        if (date_from && date_to) return 'custom_range';
        if (date_from) return `from_${date_from.toISOString().split('T')[0]}`;
        return `until_${date_to.toISOString().split('T')[0]}`;
    }

    private generateAdminRecommendations(statusBreakdown: any[], avgProcessingTime: number, dailyApprovals: any[]): string[] {
        const recommendations: string[] = [];

        const pendingCount = statusBreakdown.find(s => s.status === ProductStatus.PENDING)?._count || 0;
        const editPendingCount = statusBreakdown.find(s => s.status === ProductStatus.EDIT_PENDING)?._count || 0;

        if (pendingCount > 50) {
            recommendations.push('تعداد محصولات در انتظار بررسی زیاد است.可能需要 افزایش نیروی بررسی');
        }

        if (avgProcessingTime > 48) {
            recommendations.push('میانگین زمان پردازش بالا است. فرآیند بررسی را بهینه‌سازی کنید');
        }

        if (editPendingCount > pendingCount * 0.3) {
            recommendations.push('تعداد زیادی محصول نیاز به بررسی مجدد دارند. ممکن است نیاز به راهنمایی بهتر برای کاربران باشد');
        }

        return recommendations;
    }

// در ProductAdminService - اضافه کردن متدهای جدید

    async forceDeleteProduct(productId: string, adminUserId: string): Promise<{ success: boolean }> {
        return this.prisma.$transaction(async (tx) => {
            // حذف وابستگی‌ها
            await tx.productContent.deleteMany({ where: { product_id: productId } });
            await tx.productPrice.deleteMany({ where: { product_id: productId } });
            await tx.productAuditLog.deleteMany({ where: { product_id: productId } });

            // حذف محصول
            await tx.product.delete({ where: { id: productId } });

            await this.clearAdminCaches();

            return { success: true };
        });
    }

    

    async boostProduct(productId: string, adminUserId: string, options: {
        boost_power: number;
        duration_days: number;
        notes?: string;
    }, language: Language): Promise<any> {
        const boostExpiresAt = new Date();
        boostExpiresAt.setDate(boostExpiresAt.getDate() + options.duration_days);

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.update({
                where: { id: productId },
                data: {
                    boost_purchased: true,
                    boost_power: options.boost_power,
                    boost_expires_at: boostExpiresAt,
                    boost_is_elevated: true
                },
                include: this.getAdminProductInclude(language)
            });

            // ثبت در لاگ
            await tx.productAuditLog.create({
                data: {
                    product_id: productId,
                    user_id: adminUserId,
                    action: 'boost',
                    notes: options.notes || `بوست با قدرت ${options.boost_power} برای ${options.duration_days} روز`
                }
            });

            await this.clearAdminCaches();
            return product;
        });
    }

    async removeBoost(productId: string, adminUserId: string, language: Language): Promise<any> {
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.update({
                where: { id: productId },
                data: {
                    boost_purchased: false,
                    boost_power: 0,
                    boost_expires_at: null,
                    boost_is_elevated: false
                },
                include: this.getAdminProductInclude(language)
            });

            // ثبت در لاگ
            await tx.productAuditLog.create({
                data: {
                    product_id: productId,
                    user_id: adminUserId,
                    action: 'remove_boost',
                    notes: 'حذف بوست محصول'
                }
            });

            await this.clearAdminCaches();
            return product;
        });
    }


    // در ProductAdminService - متد exportProducts درست
    async exportProducts(filters: any, format: string = 'excel', language: Language = Language.fa) {
        const result = await this.adminSearchProducts({
            ...filters,
            limit: 10000,
            page: 1
        });

        const products = result.products;

        const exportData = products.map(product => ({
            id: product.id,
            name: product.name,
            brand_name: product.brand_name,
            category_name: product.category_info?.name,
            status: product.status,
            price: product.price_info?.final_price,
            stock: product.stock,
            min_sale_amount: product.min_sale_amount,
            unit: product.unit,
            account_name: product.account_info?.name,
            user_name: product.user_info?.full_name,
            total_views: product.stats?.views,
            total_likes: product.stats?.likes,
            created_at: product.created_at
        }));

        // تعریف ستون‌ها با نوع دقیق
        const columns: ExcelColumn[] = [
            {
                key: 'id',
                title: 'شناسه محصول',
                width: 15,
                type: 'string' as const // اضافه کردن as const
            },
            {
                key: 'name',
                title: 'نام محصول',
                width: 30,
                type: 'string' as const
            },
            {
                key: 'brand_name',
                title: 'برند',
                width: 20,
                type: 'string' as const
            },
            {
                key: 'category_name',
                title: 'دسته‌بندی',
                width: 20,
                type: 'string' as const
            },
            {
                key: 'status',
                title: 'وضعیت',
                width: 15,
                type: 'string' as const
            },
            {
                key: 'price',
                title: 'قیمت (ریال)',
                width: 15,
                type: 'currency' as const, // نوع currency
                format: '#,##0'
            },
            {
                key: 'stock',
                title: 'موجودی',
                width: 12,
                type: 'number' as const
            },
            {
                key: 'min_sale_amount',
                title: 'حداقل فروش',
                width: 15,
                type: 'number' as const
            },
            {
                key: 'unit',
                title: 'واحد',
                width: 12,
                type: 'string' as const
            },
            {
                key: 'account_name',
                title: 'حساب کسب‌وکار',
                width: 25,
                type: 'string' as const
            },
            {
                key: 'user_name',
                title: 'کاربر',
                width: 20,
                type: 'string' as const
            },
            {
                key: 'total_views',
                title: 'تعداد بازدید',
                width: 12,
                type: 'number' as const
            },
            {
                key: 'total_likes',
                title: 'تعداد لایک',
                width: 12,
                type: 'number' as const
            },
            {
                key: 'created_at',
                title: 'تاریخ ایجاد',
                width: 15,
                type: 'date' as const, // نوع date
                format: 'yyyy-mm-dd'
            }
        ];

        const config: ExportConfig = {
            filename: `products-export-${new Date().toISOString().split('T')[0]}`,
            sheetName: 'محصولات',
            columns,
            data: exportData,
            language,
            withFilters: true,
            withStyles: true
        };

        return this.excelService.generateExcelFile(config);
    }

    // در ProductAdminService - اضافه کردن متد getModerationQueue
    async getModerationQueue(moderator_id?: string, language: Language = Language.fa): Promise<any> {
        const where: Prisma.ProductWhereInput = {
            status: { in: [ProductStatus.PENDING, ProductStatus.EDIT_PENDING] }
        };

        if (moderator_id) {
            where.OR = [
                { confirmed_by: moderator_id },
                { confirmed_by: null }
            ];
        }

        const [pendingCount, editPendingCount, recentSubmissions] = await Promise.all([
            this.prisma.product.count({
                where: { ...where, status: ProductStatus.PENDING }
            }),
            this.prisma.product.count({
                where: { ...where, status: ProductStatus.EDIT_PENDING }
            }),
            this.prisma.product.findMany({
                where,
                take: 10,
                orderBy: { created_at: 'asc' },
                include: {
                    contents: {
                        where: { language },
                        select: { name: true }
                    },
                    user: {
                        select: {
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    }
                }
            })
        ]);

        return {
            queue_stats: {
                total_pending: pendingCount + editPendingCount,
                pending: pendingCount,
                edit_pending: editPendingCount,
                estimated_wait_time: this.calculateWaitTime(pendingCount + editPendingCount)
            },
            recent_submissions: recentSubmissions.map(p => ({
                id: p.id,
                name: p.contents[0]?.name,
                user: p.user?.user_name,
                user_name: `${p.user?.contents[0]?.first_name || ''} ${p.user?.contents[0]?.last_name || ''}`.trim(),
                submitted_at: p.created_at,
                status: p.status
            })),
            recommendations: this.generateQueueRecommendations(pendingCount, editPendingCount)
        };
    }

// متدهای کمکی
    private calculateWaitTime(queueSize: number): string {
        if (queueSize === 0) return 'فوری';
        if (queueSize < 10) return 'کمتر از 1 ساعت';
        if (queueSize < 50) return '1-2 ساعت';
        if (queueSize < 100) return '2-4 ساعت';
        return 'بیش از 4 ساعت';
    }

    private generateQueueRecommendations(pending: number, editPending: number): string[] {
        const recommendations = [];

        if (pending > 100) {
            recommendations.push('صف بررسی محصولات جدید پر شده است.可能需要 افزایش نیروی بررسی');
        }

        if (editPending > pending * 0.5) {
            recommendations.push('تعداد زیادی محصول نیاز به بررسی مجدد دارند. راهنمایی کاربران را بهبود بخشید');
        }

        if (pending + editPending < 10) {
            recommendations.push('صف بررسی تقریباً خالی است. می‌توانید محصولات بیشتری را بررسی کنید');
        }

        return recommendations.length > 0 ? recommendations : ['وضعیت صف بررسی مطلوب است'];
    }

    // در ProductAdminService - اضافه کردن متد getPerformanceAnalytics
    async getPerformanceAnalytics(timeframe: string = '30d', metric: string = 'views', language: Language = Language.fa): Promise<any> {
        const dateRange = this.calculateDateRange(timeframe);

        const [analytics, topProducts, statusDistribution] = await Promise.all([
            // آمار کلی
            this.prisma.product.groupBy({
                by: ['status'],
                where: {
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                },
                _count: true,
                _avg: {
                    total_views: true,
                    total_likes: true,
                    total_saves: true,
                    base_min_price: true
                }
            }),

            // محصولات برتر
            this.prisma.product.findMany({
                where: {
                    status: ProductStatus.APPROVED,
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                },
                take: 10,
                orderBy: this.getMetricOrderBy(metric),
                include: {
                    contents: {
                        where: { language },
                        select: { name: true }
                    },
                    account: {
                        select: {
                            contents: {
                                where: { language },
                                select: {
                                    name: true,
                                    company_name: true
                                }
                            }
                        }
                    }
                }
            }),

            // توزیع وضعیت
            this.prisma.product.groupBy({
                by: ['status'],
                where: {
                    created_at: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                },
                _count: true
            })
        ]);

        return {
            timeframe,
            metric,
            period: `${dateRange.start.toISOString().split('T')[0]} تا ${dateRange.end.toISOString().split('T')[0]}`,
            summary: {
                total_products: analytics.reduce((sum, item) => sum + item._count, 0),
                average_views: Math.round(analytics.reduce((sum, item) => sum + (item._avg.total_views || 0), 0) / analytics.length),
                average_likes: Math.round(analytics.reduce((sum, item) => sum + (item._avg.total_likes || 0), 0) / analytics.length),
                average_price: Math.round(analytics.reduce((sum, item) => sum + (item._avg.base_min_price || 0), 0) / analytics.length)
            },
            status_distribution: statusDistribution,
            top_performers: topProducts.map(product => ({
                id: product.id,
                name: product.contents[0]?.name,
                account: product.account?.contents[0]?.name || product.account?.contents[0]?.company_name,
                views: product.total_views,
                likes: product.total_likes,
                saves: product.total_saves,
                price: product.base_min_price,
                status: product.status
            })),
            insights: this.generateAnalyticsInsights(analytics, metric, timeframe)
        };
    }

// متدهای کمکی
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

    private getMetricOrderBy(metric: string): any {
        const orderByMap = {
            'views': { total_views: 'desc' },
            'likes': { total_likes: 'desc' },
            'saves': { total_saves: 'desc' },
            'revenue': { base_min_price: 'desc' },
            'engagement': [
                { total_likes: 'desc' },
                { total_views: 'desc' }
            ]
        };

        return orderByMap[metric] || { total_views: 'desc' };
    }

    private generateAnalyticsInsights(analytics: any[], metric: string, timeframe: string): string[] {
        const insights = [];
        const approved = analytics.find(a => a.status === ProductStatus.APPROVED);
        const pending = analytics.find(a => a.status === ProductStatus.PENDING);

        if (approved && pending) {
            const approvalRate = (approved._count / (approved._count + pending._count)) * 100;

            if (approvalRate < 60) {
                insights.push(`نرخ تایید محصولات پایین است (${approvalRate.toFixed(1)}%). ممکن است معیارهای بررسی بسیار سختگیرانه باشد`);
            }

            if (approved._avg?.total_views > 1000) {
                insights.push('محصولات تایید شده بازدید بالایی دارند که نشان‌دهنده کیفیت خوب بررسی است');
            }
        }

        // بینش بر اساس متریک
        switch (metric) {
            case 'views':
                insights.push('تمرکز بر افزایش بازدید محصولات می‌تواند منجر به فروش بیشتر شود');
                break;
            case 'likes':
                insights.push('محصولات با لایک بالا معمولاً تبدیل به فروش بهتری دارند');
                break;
            case 'engagement':
                insights.push('تعامل کاربران شاخص خوبی برای سنجش محبوبیت محصولات است');
                break;
        }

        return insights;
    }

    // در ProductAdminService - اضافه کردن متد assignToModerator
    async assignToModerator(
        productIds: string[],
        moderatorId: string,
        adminUserId: string,
        notes?: string,
        language: Language = Language.fa
    ): Promise<{ assigned: number; failed: number; details: any }> {
        let assigned = 0;
        const failed: { productId: string; error: string }[] = [];

        // تعریف وضعیت‌های قابل اختصاص
        const assignableStatuses: ProductStatus[] = [ProductStatus.PENDING, ProductStatus.EDIT_PENDING];

        for (const productId of productIds) {
            try {
                // بررسی وجود محصول
                const product = await this.prisma.product.findUnique({
                    where: { id: productId }
                });

                if (!product) {
                    failed.push({ productId, error: 'محصول یافت نشد' });
                    continue;
                }

                // بررسی اینکه محصول در وضعیت قابل بررسی باشد - روش درست
                if (!assignableStatuses.includes(product.status as ProductStatus)) {
                    failed.push({
                        productId,
                        error: `محصول در وضعیت ${product.status} قابل اختصاص نیست`
                    });
                    continue;
                }

                // اختصاص محصول به مودریتور
                await this.prisma.product.update({
                    where: { id: productId },
                    data: {
                        confirmed_by: moderatorId,
                        status: ProductStatus.PENDING // اطمینان از وضعیت مناسب
                    }
                });

                // ثبت در لاگ
                await this.prisma.productAuditLog.create({
                    data: {
                        product_id: productId,
                        user_id: adminUserId,
                        action: 'assign_to_moderator',
                        notes: `اختصاص به مودریتور ${moderatorId} - ${notes || 'بدون توضیح'}`,
                        metadata: {
                            moderator_id: moderatorId,
                            previous_moderator: product.confirmed_by,
                            admin_user_id: adminUserId,
                            notes: notes
                        }
                    }
                });

                assigned++;
            } catch (error) {
                failed.push({
                    productId,
                    error: `خطای سیستمی: ${error.message}`
                });
            }
        }

        // پاکسازی کش
        await this.clearAdminCaches();

        return {
            assigned,
            failed: failed.length,
            details: {
                total_attempted: productIds.length,
                failed_products: failed,
                success_rate: (assigned / productIds.length) * 100
            }
        };
    }
}