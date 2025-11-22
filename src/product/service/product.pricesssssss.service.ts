// src/services/product/ProductPricesssssService.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import {
    PrismaClient,
    Language,
    SellUnit,
    PricingConditionType,
    PricingConditionCategory,
    ProductPriceType,
    Prisma
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import {ProductBaseService} from "./product.base.service";
import {PrismaService} from "../../prisma/prisma.service";


@Injectable()
export class ProductPricesssssssService extends ProductBaseService {
    constructor(
        protected prisma: PrismaService,
        @Inject(CACHE_MANAGER) cacheManager: Cache
    ) {
        super(prisma, cacheManager);
    }

    // ==================== ایجاد استراتژی قیمت جدید ====================
    async createPriceStrategy(data: {
        product_id: string;
        condition_category?: PricingConditionCategory;
        condition_type?: PricingConditionType;
        price_unit: SellUnit;
        conversion_rate?: number;
        base_price_amount?: number;
        custom_adjustment_percent?: number;
        condition_config?: any;
        is_primary?: boolean;
        is_active?: boolean;
    }, userId: string, language: Language = Language.fa): Promise<any> {

        // اعتبارسنجی محصول
        const product = await this.prisma.product.findUnique({
            where: { id: data.product_id },
            select: {
                id: true,
                user_id: true,
                account_id: true,
                unit: true,
                base_min_price: true
            }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        // بررسی دسترسی کاربر
        if (product.user_id !== userId) {
            const accountUser = await this.prisma.accountUser.findUnique({
                where: {
                    user_id_account_id: {
                        user_id: userId,
                        account_id: product.account_id,
                    }
                }
            });

            if (!accountUser) {
                throw new ForbiddenException('دسترسی به این محصول ندارید');
            }
        }

        // محاسبه قیمت پایه
        const basePrice = data.base_price_amount || product.base_min_price || 0;

        // محاسبه قیمت نهایی
        const finalPrice = this.calculateFinalPrice(
            basePrice,
            data.custom_adjustment_percent
        );

        // بررسی وجود استراتژی اصلی
        if (data.is_primary) {
            await this.deactivateOtherPrimaryStrategies(data.product_id);
        }

        return this.prisma.$transaction(async (tx) => {
            const priceStrategy = await tx.productPrice.create({
                data: {
                    product_id: data.product_id,
                    condition_category: data.condition_category,
                    condition_type: data.condition_type,
                    price_unit: data.price_unit,
                    conversion_rate: data.conversion_rate || 1.0,
                    base_price_amount: basePrice,
                    custom_adjustment_percent: data.custom_adjustment_percent,
                    condition_config: data.condition_config,
                    is_primary: data.is_primary || false,
                    is_active: data.is_active !== false,
                    final_price_amount: finalPrice,
                    has_discount: !!(data.custom_adjustment_percent && data.custom_adjustment_percent < 0),
                    min_effective_price: this.calculateMinEffectivePrice(finalPrice, data.condition_config),
                    max_effective_price: this.calculateMaxEffectivePrice(finalPrice, data.condition_config)
                }
            });

            // به‌روزرسانی خلاصه قیمت محصول
            await this.updateProductPriceSummary(data.product_id, tx);

            await this.clearPriceCaches(data.product_id);

            return priceStrategy;
        });
    }

    // ==================== به‌روزرسانی استراتژی قیمت ====================
    async updatePriceStrategy(priceId: string, data: {
        condition_category?: PricingConditionCategory;
        condition_type?: PricingConditionType;
        price_unit?: SellUnit;
        conversion_rate?: number;
        base_price_amount?: number;
        custom_adjustment_percent?: number;
        condition_config?: any;
        is_primary?: boolean;
        is_active?: boolean;
    }, userId: string, language: Language = Language.fa): Promise<any> {

        // بررسی وجود استراتژی قیمت
        const existingPrice = await this.prisma.productPrice.findUnique({
            where: { id: priceId },
            include: {
                product: {
                    select: {
                        id: true,
                        user_id: true,
                        account_id: true,
                        base_min_price: true
                    }
                }
            }
        });

        if (!existingPrice) {
            throw new NotFoundException('استراتژی قیمت یافت نشد');
        }

        // بررسی دسترسی
        if (existingPrice.product.user_id !== userId) {
            const accountUser = await this.prisma.accountUser.findUnique({
                where: {
                    user_id_account_id: {
                        user_id: userId,
                        account_id: existingPrice.product.account_id,
                    }
                }
            });

            if (!accountUser) {
                throw new ForbiddenException('دسترسی به این استراتژی قیمت ندارید');
            }
        }

        // محاسبه قیمت نهایی
        const basePrice = data.base_price_amount !== undefined ?
            data.base_price_amount :
            existingPrice.base_price_amount;

        const finalPrice = this.calculateFinalPrice(
            basePrice,
            data.custom_adjustment_percent !== undefined ?
                data.custom_adjustment_percent :
                existingPrice.custom_adjustment_percent
        );

        // بررسی استراتژی اصلی
        if (data.is_primary && !existingPrice.is_primary) {
            await this.deactivateOtherPrimaryStrategies(existingPrice.product_id);
        }

        return this.prisma.$transaction(async (tx) => {
            const updatedPrice = await tx.productPrice.update({
                where: { id: priceId },
                data: {
                    condition_category: data.condition_category,
                    condition_type: data.condition_type,
                    price_unit: data.price_unit,
                    conversion_rate: data.conversion_rate,
                    base_price_amount: data.base_price_amount,
                    custom_adjustment_percent: data.custom_adjustment_percent,
                    condition_config: data.condition_config,
                    is_primary: data.is_primary,
                    is_active: data.is_active,
                    final_price_amount: finalPrice,
                    has_discount: !!(data.custom_adjustment_percent && data.custom_adjustment_percent < 0),
                    min_effective_price: this.calculateMinEffectivePrice(finalPrice, data.condition_config),
                    max_effective_price: this.calculateMaxEffectivePrice(finalPrice, data.condition_config)
                }
            });

            // به‌روزرسانی خلاصه قیمت محصول
            await this.updateProductPriceSummary(existingPrice.product_id, tx);

            await this.clearPriceCaches(existingPrice.product_id);

            return updatedPrice;
        });
    }

    // ==================== حذف استراتژی قیمت ====================
    async deletePriceStrategy(priceId: string, userId: string, language: Language = Language.fa): Promise<{ success: boolean; message: string }> {

        const priceStrategy = await this.prisma.productPrice.findUnique({
            where: { id: priceId },
            include: {
                product: {
                    select: {
                        id: true,
                        user_id: true,
                        account_id: true
                    }
                }
            }
        });

        if (!priceStrategy) {
            throw new NotFoundException('استراتژی قیمت یافت نشد');
        }

        // بررسی دسترسی
        if (priceStrategy.product.user_id !== userId) {
            const accountUser = await this.prisma.accountUser.findUnique({
                where: {
                    user_id_account_id: {
                        user_id: userId,
                        account_id: priceStrategy.product.account_id,
                    }
                }
            });

            if (!accountUser) {
                throw new ForbiddenException('دسترسی به این استراتژی قیمت ندارید');
            }
        }

        // جلوگیری از حذف استراتژی اصلی اگر تنها استراتژی است
        if (priceStrategy.is_primary) {
            const otherStrategies = await this.prisma.productPrice.count({
                where: {
                    product_id: priceStrategy.product_id,
                    id: { not: priceId },
                    is_active: true
                }
            });

            if (otherStrategies === 0) {
                throw new BadRequestException('نمی‌توان استراتژی قیمت اصلی را حذف کرد. لطفاً ابتدا یک استراتژی دیگر را به عنوان اصلی تنظیم کنید.');
            }
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.productPrice.delete({
                where: { id: priceId }
            });

            // اگر استراتژی حذف شده اصلی بود، یک استراتژی دیگر را اصلی کنیم
            if (priceStrategy.is_primary) {
                await this.setNewPrimaryStrategy(priceStrategy.product_id, tx);
            }

            // به‌روزرسانی خلاصه قیمت محصول
            await this.updateProductPriceSummary(priceStrategy.product_id, tx);

            await this.clearPriceCaches(priceStrategy.product_id);

            return {
                success: true,
                message: 'استراتژی قیمت با موفقیت حذف شد'
            };
        });
    }

    // ==================== دریافت استراتژی‌های قیمت محصول ====================
    async getProductPriceStrategies(productId: string, options: {
        active_only?: boolean;
        include_inactive?: boolean;
        by_category?: PricingConditionCategory;
        language?: Language;
    } = {}): Promise<{ strategies: any[]; summary: any }> {
        const {
            active_only = true,
            include_inactive = false,
            by_category,
            language = Language.fa
        } = options;

        const where: Prisma.ProductPriceWhereInput = {
            product_id: productId
        };

        if (active_only) {
            where.is_active = true;
        } else if (include_inactive) {
            // شامل همه می‌شود
        } else {
            where.is_active = true;
        }

        if (by_category) {
            where.condition_category = by_category;
        }

        try {
            const strategies = await this.prisma.productPrice.findMany({
                where,
                orderBy: [
                    { is_primary: 'desc' },
                    { condition_category: 'asc' },
                    { created_at: 'desc' }
                ]
            });

            const summary = this.calculatePriceSummary(strategies);

            return {
                strategies: strategies.map(strategy => ({
                    ...strategy,
                    effective_price: this.calculateEffectivePrice(strategy),
                    discount_info: this.getDiscountInfo(strategy)
                })),
                summary
            };
        } catch (error) {
            console.error('Error in getProductPriceStrategies:', error);
            throw error;
        }
    }

    // ==================== محاسبه قیمت نهایی بر اساس شرایط ====================
    async calculateFinalPriceForConditions(productId: string, conditions: {
        payment_method?: PricingConditionType;
        delivery_method?: PricingConditionType;
        customer_type?: PricingConditionType;
        quantity?: number;
        location?: string;
    }, language: Language = Language.fa): Promise<{
        price: number;
        currency: string;
        applied_strategies: any[];
        breakdown: any
    }> {

        // دریافت تمام استراتژی‌های فعال محصول
        const strategies = await this.prisma.productPrice.findMany({
            where: {
                product_id: productId,
                is_active: true
            }
        });

        if (strategies.length === 0) {
            throw new NotFoundException('هیچ استراتژی قیمتی برای این محصول یافت نشد');
        }

        // یافتن بهترین استراتژی بر اساس شرایط
        const matchingStrategies = this.findMatchingStrategies(strategies, conditions);
        const bestStrategy = this.selectBestStrategy(matchingStrategies, conditions);

        // محاسبه قیمت نهایی
        const finalPrice = bestStrategy ?
            this.calculateConditionalPrice(bestStrategy, conditions) :
            strategies.find(s => s.is_primary)?.final_price_amount ||
            strategies[0].final_price_amount;

        return {
            price: finalPrice,
            currency: 'ریال',
            applied_strategies: matchingStrategies.map(s => ({
                id: s.id,
                condition_category: s.condition_category,
                condition_type: s.condition_type,
                final_price: s.final_price_amount,
                applied: s.id === bestStrategy?.id
            })),
            breakdown: {
                base_price: bestStrategy?.base_price_amount || strategies[0].base_price_amount,
                adjustments: this.calculatePriceAdjustments(bestStrategy, conditions),
                final_calculation: this.explainPriceCalculation(bestStrategy, conditions, language)
            }
        };
    }

    // ==================== مدیریت تخفیف‌های حجمی ====================
    async manageVolumeDiscounts(productId: string, discounts: {
        min_quantity: number;
        max_quantity?: number;
        discount_percent: number;
        description?: string;
    }[], userId: string, language: Language = Language.fa): Promise<{ created: number; updated: number }> {

        // اعتبارسنجی محصول و دسترسی
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, user_id: true, account_id: true }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        if (product.user_id !== userId) {
            const accountUser = await this.prisma.accountUser.findUnique({
                where: {
                    user_id_account_id: {
                        user_id: userId,
                        account_id: product.account_id,
                    }
                }
            });

            if (!accountUser) {
                throw new ForbiddenException('دسترسی به این محصول ندارید');
            }
        }

        // اعتبارسنجی تخفیف‌ها
        this.validateVolumeDiscounts(discounts);

        return this.prisma.$transaction(async (tx) => {
            let created = 0;
            let updated = 0;

            // حذف تخفیف‌های حجمی قبلی
            await tx.productPrice.deleteMany({
                where: {
                    product_id: productId,
                    condition_category: 'ORDER_CONDITION',
                    condition_type: 'BULK_ORDER'
                }
            });

            // ایجاد تخفیف‌های جدید
            for (const discount of discounts) {
                const primaryStrategy = await tx.productPrice.findFirst({
                    where: {
                        product_id: productId,
                        is_primary: true,
                        is_active: true
                    }
                });

                if (primaryStrategy) {
                    const basePrice = primaryStrategy.base_price_amount;
                    const discountPrice = this.calculateFinalPrice(basePrice, -discount.discount_percent);

                    await tx.productPrice.create({
                        data: {
                            product_id: productId,
                            condition_category: 'ORDER_CONDITION',
                            condition_type: 'BULK_ORDER',
                            price_unit: primaryStrategy.price_unit,
                            conversion_rate: 1.0,
                            base_price_amount: basePrice,
                            custom_adjustment_percent: -discount.discount_percent,
                            condition_config: {
                                min_quantity: discount.min_quantity,
                                max_quantity: discount.max_quantity,
                                description: discount.description
                            },
                            is_primary: false,
                            is_active: true,
                            final_price_amount: discountPrice,
                            has_discount: true,
                            min_effective_price: discountPrice,
                            max_effective_price: discountPrice
                        }
                    });

                    created++;
                }
            }

            // به‌روزرسانی خلاصه قیمت محصول
            await this.updateProductPriceSummary(productId, tx);

            await this.clearPriceCaches(productId);

            return { created, updated };
        });
    }

    // ==================== تحلیل رقابتی قیمت‌ها ====================
    async analyzeCompetitivePricing(productId: string, options: {
        radius_km?: number;
        similar_products_count?: number;
        language?: Language;
    } = {}): Promise<{
        analysis: any;
        recommendations: any[];
        competitors: any[]
    }> {
        const {
            radius_km = 50,
            similar_products_count = 10,
            language = Language.fa
        } = options;

        try {
            // دریافت محصول اصلی
            const product = await this.prisma.product.findUnique({
                where: { id: productId },
                include: {
                    contents: {
                        where: { language },
                        select: {
                            name: true,
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
                    pricing_strategies: {
                        where: { is_active: true, is_primary: true },
                        take: 1
                    }
                }
            });

            if (!product) {
                throw new NotFoundException('محصول یافت نشد');
            }

            // یافتن محصولات مشابه در منطقه
            const similarProducts = await this.findSimilarProductsForPricing(
                product,
                radius_km,
                similar_products_count,
                language
            );

            // تحلیل قیمت‌ها
            const analysis = this.analyzePricingData(product, similarProducts);
            const recommendations = this.generatePricingRecommendations(analysis);
            const competitors = this.identifyTopCompetitors(similarProducts, 5);

            return {
                analysis,
                recommendations,
                competitors
            };
        } catch (error) {
            console.error('Error in analyzeCompetitivePricing:', error);
            throw error;
        }
    }

    // ==================== متدهای کمکی ====================

    private async deactivateOtherPrimaryStrategies(productId: string): Promise<void> {
        await this.prisma.productPrice.updateMany({
            where: {
                product_id: productId,
                is_primary: true,
                is_active: true
            },
            data: {
                is_primary: false
            }
        });
    }

    private async setNewPrimaryStrategy(productId: string, tx: any): Promise<void> {
        const availableStrategies = await tx.productPrice.findMany({
            where: {
                product_id: productId,
                is_active: true,
                is_primary: false
            },
            orderBy: [
                { condition_category: 'asc' },
                { created_at: 'desc' }
            ],
            take: 1
        });

        if (availableStrategies.length > 0) {
            await tx.productPrice.update({
                where: { id: availableStrategies[0].id },
                data: { is_primary: true }
            });
        }
    }



    private calculateMinEffectivePrice(finalPrice: number, conditionConfig?: any): number {
        // محاسبه حداقل قیمت موثر بر اساس پیکربندی شرایط
        if (conditionConfig?.min_price) {
            return Math.min(finalPrice, conditionConfig.min_price);
        }
        return finalPrice;
    }

    private calculateMaxEffectivePrice(finalPrice: number, conditionConfig?: any): number {
        // محاسبه حداکثر قیمت موثر بر اساس پیکربندی شرایط
        if (conditionConfig?.max_price) {
            return Math.max(finalPrice, conditionConfig.max_price);
        }
        return finalPrice;
    }

    private calculatePriceSummary(strategies: any[]): any {
        if (strategies.length === 0) {
            return {
                min_price: 0,
                max_price: 0,
                avg_price: 0,
                has_discounts: false,
                discount_range: null
            };
        }

        const prices = strategies.map(s => s.final_price_amount).filter(Boolean);
        const discountStrategies = strategies.filter(s => s.has_discount);
        const discountPercents = discountStrategies
            .map(s => s.custom_adjustment_percent)
            .filter(p => p && p < 0);

        return {
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
            has_discounts: discountStrategies.length > 0,
            discount_range: discountPercents.length > 0 ? {
                min_discount: Math.min(...discountPercents),
                max_discount: Math.max(...discountPercents)
            } : null,
            strategies_count: strategies.length,
            active_strategies: strategies.filter(s => s.is_active).length
        };
    }

    private calculateEffectivePrice(strategy: any): number {
        return strategy.final_price_amount || strategy.base_price_amount;
    }

    private getDiscountInfo(strategy: any): any {
        if (!strategy.has_discount || !strategy.custom_adjustment_percent) {
            return null;
        }

        return {
            percent: Math.abs(strategy.custom_adjustment_percent),
            amount: strategy.base_price_amount - strategy.final_price_amount,
            type: strategy.custom_adjustment_percent < 0 ? 'discount' : 'surcharge'
        };
    }

    private findMatchingStrategies(strategies: any[], conditions: any): any[] {
        return strategies.filter(strategy => {
            // منطق تطبیق استراتژی با شرایط
            if (conditions.payment_method && strategy.condition_type === conditions.payment_method) {
                return true;
            }
            if (conditions.delivery_method && strategy.condition_type === conditions.delivery_method) {
                return true;
            }
            if (conditions.customer_type && strategy.condition_type === conditions.customer_type) {
                return true;
            }
            if (conditions.quantity && strategy.condition_type === 'BULK_ORDER') {
                const config = strategy.condition_config;
                if (config && conditions.quantity >= config.min_quantity) {
                    if (!config.max_quantity || conditions.quantity <= config.max_quantity) {
                        return true;
                    }
                }
            }
            return false;
        });
    }

    private selectBestStrategy(strategies: any[], conditions: any): any {
        if (strategies.length === 0) return null;

        // اولویت‌بندی استراتژی‌ها
        return strategies.reduce((best, current) => {
            if (!best) return current;

            // اولویت با تخفیف بیشتر
            if (current.has_discount && (!best.has_discount ||
                current.custom_adjustment_percent < best.custom_adjustment_percent)) {
                return current;
            }

            return best;
        }, null);
    }

    private calculateConditionalPrice(strategy: any, conditions: any): number {
        let price = strategy.final_price_amount;

        // اعمال شرایط اضافی
        if (conditions.quantity && strategy.condition_type === 'BULK_ORDER') {
            // محاسبات اضافی برای تخفیف حجمی
            const config = strategy.condition_config;
            if (config && config.additional_discount_per_unit) {
                const extraUnits = conditions.quantity - config.min_quantity;
                if (extraUnits > 0) {
                    const extraDiscount = extraUnits * config.additional_discount_per_unit;
                    price = this.calculateFinalPrice(price, -extraDiscount);
                }
            }
        }

        return price;
    }

    private calculatePriceAdjustments(strategy: any, conditions: any): any[] {
        const adjustments = [];

        if (strategy.custom_adjustment_percent) {
            adjustments.push({
                type: strategy.custom_adjustment_percent < 0 ? 'discount' : 'surcharge',
                percent: Math.abs(strategy.custom_adjustment_percent),
                description: this.getAdjustmentDescription(strategy)
            });
        }

        return adjustments;
    }

    private getAdjustmentDescription(strategy: any): string {
        const descriptions: any = {
            'CASH_PAYMENT': 'تخفیف پرداخت نقدی',
            'BULK_ORDER': 'تخفیف حجمی',
            'CORPORATE_CUSTOMER': 'تخفیف مشتری شرکتی',
            'LOYAL_CUSTOMER': 'تخفیف مشتری وفادار'
        };

        return descriptions[strategy.condition_type] || 'تخفیف ویژه';
    }

    private explainPriceCalculation(strategy: any, conditions: any, language: Language): string {
        // تولید توضیح محاسبه قیمت
        const base = `قیمت پایه: ${strategy.base_price_amount?.toLocaleString()} ریال`;

        if (strategy.custom_adjustment_percent) {
            const adjustmentType = strategy.custom_adjustment_percent < 0 ? 'تخفیف' : 'اضافه‌بها';
            const adjustment = `${Math.abs(strategy.custom_adjustment_percent)}% ${adjustmentType}`;
            return `${base} → ${adjustment} → قیمت نهایی: ${strategy.final_price_amount?.toLocaleString()} ریال`;
        }

        return `${base} → قیمت نهایی: ${strategy.final_price_amount?.toLocaleString()} ریال`;
    }

    private validateVolumeDiscounts(discounts: any[]): void {
        for (const discount of discounts) {
            if (discount.min_quantity < 1) {
                throw new BadRequestException('حداقل مقدار باید بیشتر از 0 باشد');
            }

            if (discount.max_quantity && discount.max_quantity <= discount.min_quantity) {
                throw new BadRequestException('حداکثر مقدار باید بیشتر از حداقل مقدار باشد');
            }

            if (discount.discount_percent < 0 || discount.discount_percent > 100) {
                throw new BadRequestException('درصد تخفیف باید بین 0 تا 100 باشد');
            }
        }

        // بررسی تداخل بازه‌ها
        for (let i = 0; i < discounts.length; i++) {
            for (let j = i + 1; j < discounts.length; j++) {
                const d1 = discounts[i];
                const d2 = discounts[j];

                if (this.doRangesOverlap(d1, d2)) {
                    throw new BadRequestException('بازه‌های تخفیف حجمی نباید با هم تداخل داشته باشند');
                }
            }
        }
    }

    private doRangesOverlap(d1: any, d2: any): boolean {
        const d1Max = d1.max_quantity || Infinity;
        const d2Max = d2.max_quantity || Infinity;

        return !(d1Max < d2.min_quantity || d2Max < d1.min_quantity);
    }

    private async findSimilarProductsForPricing(product: any, radiusKm: number, count: number, language: Language): Promise<any[]> {
        // پیاده‌سازی یافتن محصولات مشابه برای تحلیل رقابتی
        // این یک پیاده‌سازی ساده است
        return [];
    }

    private analyzePricingData(mainProduct: any, similarProducts: any[]): any {
        // تحلیل داده‌های قیمتی
        const mainPrice = mainProduct.pricing_strategies?.[0]?.final_price_amount || 0;
        const competitorPrices = similarProducts
            .map(p => p.pricing_strategies?.[0]?.final_price_amount)
            .filter(Boolean);

        if (competitorPrices.length === 0) {
            return {
                main_product_price: mainPrice,
                average_competitor_price: mainPrice,
                price_position: 'no_competition',
                recommendation_confidence: 0
            };
        }

        const avgCompetitorPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
        const minCompetitorPrice = Math.min(...competitorPrices);
        const maxCompetitorPrice = Math.max(...competitorPrices);

        let pricePosition = 'competitive';
        if (mainPrice < minCompetitorPrice * 0.9) pricePosition = 'low';
        else if (mainPrice > maxCompetitorPrice * 1.1) pricePosition = 'high';

        return {
            main_product_price: mainPrice,
            average_competitor_price: Math.round(avgCompetitorPrice),
            min_competitor_price: minCompetitorPrice,
            max_competitor_price: maxCompetitorPrice,
            price_difference_percent: Math.round(((mainPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100),
            price_position: pricePosition,
            market_coverage: this.calculateMarketCoverage(mainPrice, competitorPrices),
            recommendation_confidence: this.calculateRecommendationConfidence(competitorPrices.length)
        };
    }

    private calculateMarketCoverage(mainPrice: number, competitorPrices: number[]): string {
        const lowerCount = competitorPrices.filter(p => p < mainPrice).length;
        const percentage = (lowerCount / competitorPrices.length) * 100;

        if (percentage < 20) return 'premium';
        if (percentage < 50) return 'mid_high';
        if (percentage < 80) return 'mid_low';
        return 'budget';
    }

    private calculateRecommendationConfidence(competitorCount: number): number {
        return Math.min(1, competitorCount / 10);
    }

    private generatePricingRecommendations(analysis: any): any[] {
        const recommendations = [];

        if (analysis.price_position === 'high' && analysis.price_difference_percent > 10) {
            recommendations.push({
                type: 'price_reduction',
                confidence: analysis.recommendation_confidence,
                suggestion: `کاهش قیمت به حدود ${Math.round(analysis.average_competitor_price * 1.05).toLocaleString()} ریال برای رقابت بهتر`,
                expected_impact: 'افزایش فروش و رقابت‌پذیری'
            });
        } else if (analysis.price_position === 'low' && analysis.price_difference_percent < -15) {
            recommendations.push({
                type: 'price_increase',
                confidence: analysis.recommendation_confidence,
                suggestion: `افزایش قیمت به حدود ${Math.round(analysis.average_competitor_price * 0.95).toLocaleString()} ریال برای افزایش حاشیه سود`,
                expected_impact: 'افزایش سود بدون تاثیر منفی بر فروش'
            });
        }

        if (analysis.market_coverage === 'premium') {
            recommendations.push({
                type: 'value_communication',
                confidence: 0.8,
                suggestion: 'تاکید بر مزایا و کیفیت بالای محصول در بازاریابی',
                expected_impact: 'توجیه قیمت بالاتر برای مشتریان'
            });
        }

        return recommendations;
    }

    private identifyTopCompetitors(similarProducts: any[], count: number): any[] {
        return similarProducts
            .slice(0, count)
            .map(product => ({
                id: product.id,
                name: product.contents?.[0]?.name,
                price: product.pricing_strategies?.[0]?.final_price_amount,
                brand: product.contents?.[0]?.brand_name,
                score: this.calculateCompetitorScore(product)
            }))
            .sort((a, b) => b.score - a.score);
    }

    private calculateCompetitorScore(product: any): number {
        // محاسبه امتیاز رقیب بر اساس عوامل مختلف
        let score = 0;

        if (product.pricing_strategies?.[0]?.final_price_amount) {
            score += 30; // قیمت
        }

        if (product.total_views) {
            score += Math.log(product.total_views + 1) * 10; // محبوبیت
        }

        if (product.total_likes) {
            score += product.total_likes * 2; // تعامل
        }

        return score;
    }


}