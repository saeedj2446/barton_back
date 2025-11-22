// src/product-price/product-price.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductPriceDto } from './dto/create-product-price.dto';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';
import { ProductPriceQueryDto } from './dto/product-price-query.dto';
import { PricingConditionCategory, PricingConditionType, SellUnit, Language } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nConflictException,
    I18nBadRequestException,
    I18nInternalServerErrorException,
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class ProductPriceService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // ==================== ایجاد قیمت جدید ====================
    async create(createProductPriceDto: CreateProductPriceDto, userId: string, language: Language = Language.fa) {
        const {
            product_id,
            price_unit,
            base_price_amount,
            conversion_rate = 1.0,
            condition_type,
            condition_category,
            custom_adjustment_percent,
            condition_config
        } = createProductPriceDto;

        // بررسی وجود محصول
        const product = await this.prisma.product.findUnique({
            where: { id: product_id },
            select: {
                id: true,
                user_id: true,
                account_id: true,
                unit: true,
                account: {
                    select: {
                        account_users: {
                            where: {
                                user_id: userId,
                                account_role: { in: ['OWNER', 'MANAGER', 'PRODUCT_MANAGER'] }
                            }
                        }
                    }
                }
            }
        });

        if (!product) {
            throw new I18nNotFoundException('PRODUCT_NOT_FOUND', language, { id: product_id });
        }

        // بررسی دسترسی کاربر
        const hasAccess = product.user_id === userId ||
            (product.account && product.account.account_users.length > 0);

        if (!hasAccess) {
            throw new I18nConflictException('ACCESS_DENIED', language);
        }

        // بررسی تکراری نبودن قیمت با شرایط یکسان
        const existingPrice = await this.prisma.productPrice.findFirst({
            where: {
                product_id,
                price_unit,
                condition_type: condition_type || null,
                condition_category: condition_category || null,
                is_active: true
            }
        });

        if (existingPrice) {
            throw new I18nConflictException('DUPLICATE_ENTRY', language);
        }

        // محاسبه قیمت نهایی
        const final_price_amount = this.calculateFinalPrice(base_price_amount, custom_adjustment_percent);

        // بررسی وجود قیمت اصلی برای این محصول
        const existingPrimary = await this.prisma.productPrice.findFirst({
            where: {
                product_id,
                is_primary: true,
                is_active: true
            }
        });

        const is_primary = !existingPrimary && !condition_type;

        try {
            const productPrice = await this.prisma.productPrice.create({
                data: {
                    product_id,
                    price_unit,
                    base_price_amount,
                    conversion_rate,
                    condition_type,
                    condition_category,
                    custom_adjustment_percent,
                    final_price_amount,
                    is_primary,
                    is_active: true,
                    min_effective_price: final_price_amount,
                    max_effective_price: final_price_amount,
                    has_discount: custom_adjustment_percent ? custom_adjustment_percent < 0 : false,
                    condition_config
                },
                include: {
                    product: {
                        select: {
                            id: true,
                            unit: true,
                            contents: {
                                where: { language },
                                take: 1
                            }
                        }
                    }
                }
            });

            // پاکسازی کش
            await this.clearProductPriceCache(product_id);

            return {
                ...productPrice,
                product: {
                    ...productPrice.product,
                    name: productPrice.product.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language)
                }
            };

        } catch (error) {
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('PRODUCT_PRICE_CREATE_ERROR', language);
        }
    }

    // ==================== دریافت قیمت‌های یک محصول ====================
    async findByProduct(productId: string, userId?: string, language: Language = Language.fa) {
        const cacheKey = `product_prices:${productId}:${language}`;

        // بررسی کش
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        // بررسی وجود محصول
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: {
                contents: {
                    where: { language },
                    take: 1
                },
                account: {
                    include: {
                        account_users: userId ? {
                            where: { user_id: userId }
                        } : undefined
                    }
                }
            }
        });

        if (!product) {
            throw new I18nNotFoundException('PRODUCT_NOT_FOUND', language, { id: productId });
        }

        // اگر کاربر لاگین کرده و مالک محصول نیست، فقط قیمت‌های فعال را نشان بده
        const where: any = { product_id: productId };
        if (userId && product.user_id !== userId) {
            const isAccountUser = product.account?.account_users && product.account.account_users.length > 0;
            if (!isAccountUser) {
                where.is_active = true;
            }
        }

        const prices = await this.prisma.productPrice.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        unit: true,
                        contents: {
                            where: { language },
                            take: 1
                        }
                    }
                }
            },
            orderBy: [
                { is_primary: 'desc' },
                { condition_category: 'asc' },
                { created_at: 'desc' }
            ]
        });

        const result = {
            product_id: productId,
            name: product.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language),
            product_unit: product.unit,
            prices: this.groupPricesByCategory(prices.map(price => ({
                ...price,
                product: {
                    ...price.product,
                    name: price.product.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language)
                }
            })))
        };

        // ذخیره در کش
        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);

        return result;
    }

    // ==================== جستجوی قیمت‌ها ====================
    async search(query: ProductPriceQueryDto, language: Language = Language.fa) {
        const cacheKey = `product_prices_search:${JSON.stringify(query)}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const {
            product_id,
            price_unit,
            condition_category,
            condition_type,
            min_price,
            max_price,
            has_discount,
            is_active = true,
            page = 1,
            limit = 20
        } = query;

        const skip = (page - 1) * limit;

        const where: any = { is_active };

        if (product_id) where.product_id = product_id;
        if (price_unit) where.price_unit = price_unit;
        if (condition_category) where.condition_category = condition_category;
        if (condition_type) where.condition_type = condition_type;
        if (has_discount !== undefined) where.has_discount = has_discount;

        if (min_price !== undefined || max_price !== undefined) {
            where.final_price_amount = {};
            if (min_price !== undefined) where.final_price_amount.gte = min_price;
            if (max_price !== undefined) where.final_price_amount.lte = max_price;
        }

        try {
            const [prices, total] = await Promise.all([
                this.prisma.productPrice.findMany({
                    where,
                    skip,
                    take: limit,
                    include: {
                        product: {
                            include: {
                                contents: {
                                    where: { language },
                                    take: 1
                                },
                                category: {
                                    include: {
                                        contents: {
                                            where: { language },
                                            take: 1
                                        }
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { final_price_amount: 'asc' }
                }),
                this.prisma.productPrice.count({ where })
            ]);

            const formattedPrices = prices.map(price => ({
                ...price,
                product: {
                    ...price.product,
                    name: price.product.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language),
                    category_name: price.product.category?.contents[0]?.name || this.i18nService.t('UNKNOWN_CATEGORY', language)
                }
            }));

            const result = {
                data: formattedPrices,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // ==================== بروزرسانی قیمت ====================
    async update(id: string, updateProductPriceDto: UpdateProductPriceDto, userId: string, language: Language = Language.fa) {
        const price = await this.prisma.productPrice.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        id: true,
                        user_id: true,
                        account_id: true,
                        account: {
                            select: {
                                account_users: {
                                    where: {
                                        user_id: userId,
                                        account_role: { in: ['OWNER', 'MANAGER', 'PRODUCT_MANAGER'] }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!price) {
            throw new I18nNotFoundException('PRODUCT_PRICE_NOT_FOUND', language, { id });
        }

        // بررسی دسترسی کاربر
        const hasAccess = price.product.user_id === userId ||
            (price.product.account && price.product.account.account_users.length > 0);

        if (!hasAccess) {
            throw new I18nConflictException('ACCESS_DENIED', language);
        }

        const { base_price_amount, custom_adjustment_percent, conversion_rate, is_active, condition_config } = updateProductPriceDto;

        const final_price_amount = this.calculateFinalPrice(
            base_price_amount ?? price.base_price_amount,
            custom_adjustment_percent ?? price.custom_adjustment_percent
        );

        try {
            const updatedPrice = await this.prisma.productPrice.update({
                where: { id },
                data: {
                    ...(base_price_amount !== undefined && { base_price_amount }),
                    ...(custom_adjustment_percent !== undefined && { custom_adjustment_percent }),
                    ...(conversion_rate !== undefined && { conversion_rate }),
                    ...(is_active !== undefined && { is_active }),
                    ...(condition_config !== undefined && { condition_config }),
                    final_price_amount,
                    min_effective_price: final_price_amount,
                    max_effective_price: final_price_amount,
                    has_discount: (custom_adjustment_percent ?? price.custom_adjustment_percent)
                        ? (custom_adjustment_percent ?? price.custom_adjustment_percent) < 0
                        : false
                },
                include: {
                    product: {
                        select: {
                            id: true,
                            unit: true,
                            contents: {
                                where: { language },
                                take: 1
                            }
                        }
                    }
                }
            });

            // پاکسازی کش
            await this.clearProductPriceCache(price.product_id);

            return {
                ...updatedPrice,
                product: {
                    ...updatedPrice.product,
                    name: updatedPrice.product.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language)
                }
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('PRODUCT_PRICE_UPDATE_ERROR', language);
        }
    }

    // ==================== حذف قیمت ====================
    async remove(id: string, userId: string, language: Language = Language.fa) {
        const price = await this.prisma.productPrice.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        id: true,
                        user_id: true,
                        account_id: true,
                        account: {
                            select: {
                                account_users: {
                                    where: {
                                        user_id: userId,
                                        account_role: { in: ['OWNER', 'MANAGER', 'PRODUCT_MANAGER'] }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!price) {
            throw new I18nNotFoundException('PRODUCT_PRICE_NOT_FOUND', language, { id });
        }

        // بررسی دسترسی کاربر
        const hasAccess = price.product.user_id === userId ||
            (price.product.account && price.product.account.account_users.length > 0);

        if (!hasAccess) {
            throw new I18nConflictException('ACCESS_DENIED', language);
        }

        // اگر قیمت اصلی است، نمی‌توان حذفش کرد
        if (price.is_primary) {
            throw new I18nBadRequestException('CANNOT_DELETE_PRIMARY_PRICE', language);
        }

        try {
            await this.prisma.productPrice.delete({
                where: { id }
            });

            // پاکسازی کش
            await this.clearProductPriceCache(price.product_id);

            return {
                message: this.i18nService.t('PRODUCT_PRICE_DELETED_SUCCESS', language),
                success: true
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('PRODUCT_PRICE_DELETE_ERROR', language);
        }
    }

    // ==================== تنظیم قیمت اصلی ====================
    async setPrimaryPrice(productId: string, priceId: string, userId: string, language: Language = Language.fa) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                user_id: true,
                account_id: true,
                account: {
                    select: {
                        account_users: {
                            where: {
                                user_id: userId,
                                account_role: { in: ['OWNER', 'MANAGER', 'PRODUCT_MANAGER'] }
                            }
                        }
                    }
                }
            }
        });

        if (!product) {
            throw new I18nNotFoundException('PRODUCT_NOT_FOUND', language, { id: productId });
        }

        // بررسی دسترسی کاربر
        const hasAccess = product.user_id === userId ||
            (product.account && product.account.account_users.length > 0);

        if (!hasAccess) {
            throw new I18nConflictException('ACCESS_DENIED', language);
        }

        const price = await this.prisma.productPrice.findUnique({
            where: { id: priceId, product_id: productId }
        });

        if (!price) {
            throw new I18nNotFoundException('PRODUCT_PRICE_NOT_FOUND', language, { id: priceId });
        }

        if (!price.is_active) {
            throw new I18nBadRequestException('CANNOT_SET_INACTIVE_PRICE_AS_PRIMARY', language);
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                // حذف وضعیت اصلی از همه قیمت‌های این محصول
                await tx.productPrice.updateMany({
                    where: { product_id: productId, is_primary: true },
                    data: { is_primary: false }
                });

                // تنظیم قیمت جدید به عنوان اصلی
                const updatedPrice = await tx.productPrice.update({
                    where: { id: priceId },
                    data: { is_primary: true },
                    include: {
                        product: {
                            select: {
                                id: true,
                                unit: true,
                                contents: {
                                    where: { language },
                                    take: 1
                                }
                            }
                        }
                    }
                });

                // آپدیت محصول با اطلاعات قیمت اصلی
                await tx.product.update({
                    where: { id: productId },
                    data: {
                        base_min_price: updatedPrice.final_price_amount,
                        base_max_price: updatedPrice.final_price_amount,
                    }
                });

                // پاکسازی کش
                await this.clearProductPriceCache(productId);

                return {
                    ...updatedPrice,
                    product: {
                        ...updatedPrice.product,
                        name: updatedPrice.product.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language)
                    }
                };
            });

        } catch (error) {
            throw new I18nInternalServerErrorException('SET_PRIMARY_PRICE_ERROR', language);
        }
    }

    // ==================== محاسبه قیمت نهایی بر اساس شرایط ====================
    async calculatePriceForConditions(
        productId: string,
        conditions: {
            quantity?: number;
            customer_type?: PricingConditionType;
            payment_method?: PricingConditionType;
            delivery_method?: PricingConditionType;
            location_condition?: PricingConditionType;
        },
        language: Language = Language.fa
    ) {
        const prices = await this.prisma.productPrice.findMany({
            where: {
                product_id: productId,
                is_active: true
            },
            orderBy: [
                { is_primary: 'desc' },
                { condition_category: 'asc' }
            ]
        });

        if (prices.length === 0) {
            throw new I18nNotFoundException('NO_ACTIVE_PRICES_FOUND', language, { productId });
        }

        const primaryPrice = prices.find(p => p.is_primary) || prices[0];
        let finalPrice = primaryPrice.final_price_amount;

        // اعمال شرایط مختلف
        for (const price of prices) {
            if (!price.condition_type) continue;

            if (conditions.customer_type && price.condition_type === conditions.customer_type) {
                finalPrice = price.final_price_amount;
                break;
            }

            if (conditions.payment_method && price.condition_type === conditions.payment_method) {
                finalPrice = price.final_price_amount;
                break;
            }

            if (conditions.delivery_method && price.condition_type === conditions.delivery_method) {
                finalPrice = price.final_price_amount;
                break;
            }

            if (conditions.location_condition && price.condition_type === conditions.location_condition) {
                finalPrice = price.final_price_amount;
                break;
            }
        }

        // اعمال تخفیف حجمی
        if (conditions.quantity && conditions.quantity > 1) {
            const volumePrices = prices.filter(p =>
                p.condition_category === 'ORDER_CONDITION' &&
                p.condition_config
            );

            for (const volumePrice of volumePrices) {
                try {
                    const config = volumePrice.condition_config as any;
                    if (config.min_quantity && conditions.quantity >= config.min_quantity) {
                        finalPrice = volumePrice.final_price_amount;
                        break;
                    }
                } catch (error) {
                    // اگر config مشکل داشت، نادیده بگیر
                    console.warn('Invalid volume price config:', error);
                }
            }
        }

        return {
            product_id: productId,
            base_price: primaryPrice.final_price_amount,
            final_price: finalPrice,
            discount_amount: primaryPrice.final_price_amount - finalPrice,
            discount_percent: primaryPrice.final_price_amount > 0 ?
                ((primaryPrice.final_price_amount - finalPrice) / primaryPrice.final_price_amount) * 100 : 0,
            applied_conditions: this.getAppliedConditions(prices, conditions),
            available_prices: this.groupPricesByCategory(prices)
        };
    }

    // ==================== دریافت قیمت‌های قابل فیلتر ====================
    async getPriceFilters(productId?: string, language: Language = Language.fa) {
        const where = productId ? { product_id: productId, is_active: true } : { is_active: true };

        try {
            const prices = await this.prisma.productPrice.findMany({
                where,
                select: {
                    price_unit: true,
                    condition_category: true,
                    condition_type: true,
                    final_price_amount: true,
                    has_discount: true
                }
            });

            const filters = {
                price_units: [...new Set(prices.map(p => p.price_unit))],
                condition_categories: [...new Set(prices.map(p => p.condition_category).filter(Boolean))],
                condition_types: [...new Set(prices.map(p => p.condition_type).filter(Boolean))],
                price_range: {
                    min: prices.length > 0 ? Math.min(...prices.map(p => p.final_price_amount)) : 0,
                    max: prices.length > 0 ? Math.max(...prices.map(p => p.final_price_amount)) : 0
                },
                has_discount: prices.some(p => p.has_discount)
            };

            return filters;

        } catch (error) {
            throw new I18nInternalServerErrorException('PRICE_FILTERS_FETCH_ERROR', language);
        }
    }

    // ==================== آمار و گزارشات ====================
    async getPriceStats(productId?: string, language: Language = Language.fa) {
        const where = productId ? { product_id: productId, is_active: true } : { is_active: true };

        try {
            const [totalPrices, pricesWithDiscount, averagePrice, priceByCategory] = await Promise.all([
                this.prisma.productPrice.count({ where }),
                this.prisma.productPrice.count({ where: { ...where, has_discount: true } }),
                this.prisma.productPrice.aggregate({
                    where,
                    _avg: { final_price_amount: true }
                }),
                this.prisma.productPrice.groupBy({
                    by: ['condition_category'],
                    where,
                    _count: true,
                    _avg: { final_price_amount: true }
                })
            ]);

            return {
                total_prices: totalPrices,
                prices_with_discount: pricesWithDiscount,
                discount_ratio: totalPrices > 0 ? (pricesWithDiscount / totalPrices) * 100 : 0,
                average_price: Math.round(averagePrice._avg.final_price_amount || 0),
                by_category: priceByCategory.map(cat => ({
                    category: cat.condition_category || 'primary',
                    count: cat._count,
                    average_price: Math.round(cat._avg.final_price_amount || 0)
                }))
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('PRICE_STATS_FETCH_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private calculateFinalPrice(basePrice: number, adjustmentPercent?: number): number {
        if (!basePrice) return 0;

        let finalPrice = basePrice;
        if (adjustmentPercent) {
            finalPrice = basePrice * (1 + adjustmentPercent / 100);
        }

        return Math.round(finalPrice);
    }

    private groupPricesByCategory(prices: any[]) {
        const grouped: any = {
            primary: [],
            payment_settlement: [],
            delivery_method: [],
            customer_type: [],
            time_condition: [],
            order_condition: [],
            location_condition: [],
            special_offer: []
        };

        for (const price of prices) {
            const category = price.condition_category?.toLowerCase() || 'primary';
            if (grouped[category]) {
                grouped[category].push(price);
            } else {
                grouped.primary.push(price);
            }
        }

        // حذف دسته‌های خالی
        Object.keys(grouped).forEach(key => {
            if (grouped[key].length === 0 && key !== 'primary') {
                delete grouped[key];
            }
        });

        return grouped;
    }

    private getAppliedConditions(prices: any[], conditions: any): string[] {
        const applied: string[] = [];

        if (conditions.customer_type) {
            const customerPrice = prices.find(p => p.condition_type === conditions.customer_type);
            if (customerPrice) applied.push('customer_type');
        }

        if (conditions.payment_method) {
            const paymentPrice = prices.find(p => p.condition_type === conditions.payment_method);
            if (paymentPrice) applied.push('payment_method');
        }

        if (conditions.delivery_method) {
            const deliveryPrice = prices.find(p => p.condition_type === conditions.delivery_method);
            if (deliveryPrice) applied.push('delivery_method');
        }

        if (conditions.location_condition) {
            const locationPrice = prices.find(p => p.condition_type === conditions.location_condition);
            if (locationPrice) applied.push('location_condition');
        }

        if (conditions.quantity && conditions.quantity > 1) {
            applied.push('volume_discount');
        }

        return applied;
    }

    // ==================== مدیریت کش ====================

    private async clearProductPriceCache(productId: string) {
        const cacheKeys = [
            `product_prices:${productId}:*`,
            `product_prices_search:*`
        ];

        try {
            // در اینجا باید منطق پاکسازی کش بر اساس پترن را پیاده‌سازی کنید
            // این بستگی به implementation cache manager دارد
            for (const pattern of cacheKeys) {
                // اگر cache manager شما از پترن پشتیبانی می‌کند:
                // await this.cacheManager.delPattern(pattern);

                // یا به صورت دستی keyهای مرتبط را پیدا و پاک کنید
            }
        } catch (error) {
            console.error('Error clearing product price cache:', error);
        }
    }

    // به ProductPriceService اضافه کنید:
    async findOne(id: string, language: Language = Language.fa) {
        const cacheKey = `product_price:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const price = await this.prisma.productPrice.findUnique({
            where: { id },
            include: {
                product: {
                    include: {
                        contents: {
                            where: { language },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!price) {
            throw new I18nNotFoundException('PRODUCT_PRICE_NOT_FOUND', language, { id });
        }

        const result = {
            ...price,
            product: {
                ...price.product,
                name: price.product.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language)
            }
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }
}