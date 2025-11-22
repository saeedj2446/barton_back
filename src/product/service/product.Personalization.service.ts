// src/services/product/ProductPersonalizationService.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import {
    PrismaClient,
    Language,
    UserActivityType,
    InteractionType,
    ProductStatus,
    Prisma,
    FileUsage
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import {ProductBaseService} from "./product.base.service";
import {UserBehaviorService} from "../../ account-user-behavior/user-behavior.service";
import {AccountUserActivityService} from "../../account-user-activity/account-user-activity.service";
import {PrismaService} from "../../prisma/prisma.service";


@Injectable()
export class ProductPersonalizationService extends ProductBaseService {
    constructor(
        protected prisma: PrismaService,
        @Inject(CACHE_MANAGER) protected cacheManager: Cache,
        private activityService: AccountUserActivityService
    ) {
        super(prisma, cacheManager); // ارسال prisma به parent
    }

    // ==================== دریافت محصولات پیشنهادی بر اساس رفتار کاربر ====================
    async getPersonalizedRecommendations(accountUserId: string, options: {
        limit?: number;
        language?: Language;
        exclude_viewed?: boolean;
        diversity_factor?: number;
    } = {}): Promise<{ products: any[]; recommendations: any }> {
        const {
            limit = 20,
            language = Language.fa,
            exclude_viewed = true,
            diversity_factor = 0.3
        } = options;

        const cacheKey = `personalized_recs:${accountUserId}:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any;
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        try {
            // دریافت پروفایل رفتار کاربر
            const userProfile = await this.getUserBehaviorProfile(accountUserId, language);

            // اگر اطلاعات کافی از کاربر نداریم، محصولات محبوب رو برگردون
            if (userProfile.insufficiency_score > 0.7) {
                const fallbackProducts = await this.getFallbackRecommendations(limit, language);
                return {
                    products: fallbackProducts,
                    recommendations: {
                        type: 'fallback',
                        reason: 'insufficient_user_data',
                        confidence: 0.3
                    }
                };
            }

            // ساخت کوئری شخصی‌سازی شده
            const where = this.buildPersonalizedWhereClause(userProfile, exclude_viewed);
            const orderBy = this.buildPersonalizedOrderBy(userProfile, diversity_factor);

            const products = await this.prisma.product.findMany({
                where,
                take: limit * 2, // بیشتر می‌گیریم برای تنوع‌بخشی
                include: this.getPersonalizedProductInclude(language),
                orderBy,
            });

            // اعمال الگوریتم‌های شخصی‌سازی
            const scoredProducts = await this.scoreProductsForUser(products, userProfile, language);

            // تنوع‌بخشی به نتایج
            const diversifiedProducts = this.diversifyRecommendations(
                scoredProducts,
                diversity_factor,
                limit
            );

            const result = {
                products: diversifiedProducts,
                recommendations: {
                    type: 'personalized',
                    confidence: userProfile.confidence_score,
                    factors: userProfile.primary_factors,
                    user_segment: userProfile.segment,
                    generated_at: new Date()
                }
            };

            try {
                await this.cacheManager.set(cacheKey, result, 15 * 60 * 1000); // 15 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return result;
        } catch (error) {
            console.error('Error in getPersonalizedRecommendations:', error);
            // Fallback to popular products
            const fallbackProducts = await this.getFallbackRecommendations(limit, language);
            return {
                products: fallbackProducts,
                recommendations: {
                    type: 'fallback',
                    reason: 'error_in_personalization',
                    confidence: 0.1
                }
            };
        }
    }

    // ==================== محصولات مشابه بر اساس محصولات دیده شده ====================
    async getSimilarToViewed(accountUserId: string, options: {
        limit?: number;
        language?: Language;
        min_similarity_score?: number;
    } = {}): Promise<{ products: any[]; based_on: any }> {
        const {
            limit = 12,
            language = Language.fa,
            min_similarity_score = 0.6
        } = options;

        const cacheKey = `similar_to_viewed:${accountUserId}:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any;
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        try {
            // دریافت محصولات اخیراً دیده شده
            const recentViews = await this.prisma.accountUserActivity.findMany({
                where: {
                    account_user_id: accountUserId,
                    activity_type: UserActivityType.PRODUCT_VIEW,
                    created_at: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 روز گذشته
                    }
                },
                orderBy: { created_at: 'desc' },
                take: 10,
                include: {
                    product: {
                        select: {
                            id: true,
                            category_id: true,
                            sub_category_id: true,
                            // استفاده از join با ProductPrice برای قیمت
                            pricing_strategies: {
                                where: {
                                    is_active: true,
                                    is_primary: true
                                },
                                take: 1,
                                select: {
                                    final_price_amount: true
                                }
                            },
                            contents: {
                                where: { language },
                                select: {
                                    brand_name: true,
                                    category_name: true
                                }
                            }
                        }
                    }
                }
            });

            if (recentViews.length === 0) {
                return {
                    products: [],
                    based_on: { reason: 'no_recent_views' }
                };
            }

            // استخراج ویژگی‌های محصولات دیده شده
            const viewedFeatures = this.extractProductFeatures(recentViews.map(v => v.product));

            // یافتن محصولات مشابه
            const similarProducts = await this.findSimilarProducts(
                viewedFeatures,
                limit,
                language,
                min_similarity_score
            );

            const result = {
                products: similarProducts,
                based_on: {
                    viewed_count: recentViews.length,
                    time_period: '30_days',
                    primary_categories: viewedFeatures.categories.slice(0, 3),
                    primary_brands: viewedFeatures.brands.slice(0, 3),
                    price_range: viewedFeatures.price_range
                }
            };

            try {
                await this.cacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return result;
        } catch (error) {
            console.error('Error in getSimilarToViewed:', error);
            throw error;
        }
    }

    private async findSimilarProducts(
        viewedFeatures: any,
        limit: number,
        language: Language,
        minSimilarityScore: number
    ): Promise<any[]> {

        const where: Prisma.ProductWhereInput = {
            status: ProductStatus.APPROVED,
            confirmed: true,
            files: {
                some: {
                    file_usage: FileUsage.PRODUCT_IMAGE,
                    status: "2"
                }
            }
        };

        // ساخت شرط OR برای دسته‌بندی‌های مشابه
        if (viewedFeatures.categories.length > 0) {
            where.OR = viewedFeatures.categories.map((category: string) => ({
                contents: {
                    some: {
                        category_name: { contains: category, mode: 'insensitive' }
                    }
                }
            }));
        }

        // فیلتر قیمت در محدوده مشابه
        if (viewedFeatures.price_range.min > 0 && viewedFeatures.price_range.max > 0) {
            const priceMargin = (viewedFeatures.price_range.max - viewedFeatures.price_range.min) * 0.3; // 30% حاشیه
            where.pricing_strategies = {
                some: {
                    is_active: true,
                    is_primary: true,
                    final_price_amount: {
                        gte: Math.max(0, viewedFeatures.price_range.min - priceMargin),
                        lte: viewedFeatures.price_range.max + priceMargin
                    }
                }
            };
        }

        try {
            const products = await this.prisma.product.findMany({
                where,
                take: limit * 3, // بیشتر می‌گیریم برای امتیازدهی
                include: {
                    account: {
                        select: {
                            id: true,
                            activity_type: true,
                            profile_photo: true,
                            confirmed: true,
                            contents: {
                                where: { language },
                                select: {
                                    name: true,
                                    company_name: true
                                }
                            }
                        }
                    },
                    contents: {
                        where: { language },
                        select: {
                            name: true,
                            description: true,
                            brand_name: true,
                            category_name: true,
                            tags: true
                        }
                    },
                    _count: {
                        select: {
                            reviews: { where: { confirmed: true } },
                            interactions: true,
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
                    }
                },
                orderBy: [
                    { boost_purchased: 'desc' },
                    { total_views: 'desc' }
                ],
            });

            // امتیازدهی شباهت
            const scoredProducts = products.map(product => {
                const similarityScore = this.calculateSimilarityScore(product, viewedFeatures);
                return {
                    ...product,
                    similarity_score: similarityScore
                };
            });

            // فیلتر بر اساس حداقل امتیاز شباهت و مرتب‌سازی
            const filteredProducts = scoredProducts
                .filter(product => product.similarity_score >= minSimilarityScore)
                .sort((a, b) => b.similarity_score - a.similarity_score)
                .slice(0, limit);

            return filteredProducts.map(p => this.enrichPersonalizedProduct(p, language));
        } catch (error) {
            console.error('Error in findSimilarProducts:', error);
            return [];
        }
    }

    private calculateSimilarityScore(product: any, viewedFeatures: any): number {
        let score = 0;
        const content = product.contents?.[0];
        const primaryPrice = product.pricing_strategies?.[0];

        // امتیاز شباهت دسته‌بندی (40%)
        if (content?.category_name) {
            const categoryMatch = viewedFeatures.categories.some((category: string) =>
                content.category_name.toLowerCase().includes(category.toLowerCase()) ||
                category.toLowerCase().includes(content.category_name.toLowerCase())
            );
            if (categoryMatch) {
                score += 0.4;
            }
        }

        // امتیاز شباهت برند (30%)
        if (content?.brand_name) {
            const brandMatch = viewedFeatures.brands.some((brand: string) =>
                content.brand_name.toLowerCase().includes(brand.toLowerCase()) ||
                brand.toLowerCase().includes(content.brand_name.toLowerCase())
            );
            if (brandMatch) {
                score += 0.3;
            }
        }

        // امتیاز شباهت قیمت (30%)
        if (primaryPrice?.final_price_amount && viewedFeatures.price_range.min > 0) {
            const price = primaryPrice.final_price_amount;
            const inRange = price >= viewedFeatures.price_range.min && price <= viewedFeatures.price_range.max;

            if (inRange) {
                score += 0.3; // امتیاز کامل برای قیمت در محدوده
            } else {
                // امتیاز نسبی برای قیمت‌های نزدیک به محدوده
                const distanceToMin = Math.abs(price - viewedFeatures.price_range.min);
                const distanceToMax = Math.abs(price - viewedFeatures.price_range.max);
                const minDistance = Math.min(distanceToMin, distanceToMax);
                const rangeSize = viewedFeatures.price_range.max - viewedFeatures.price_range.min;

                if (rangeSize > 0) {
                    const normalizedDistance = minDistance / rangeSize;
                    score += Math.max(0, 0.3 - normalizedDistance * 0.3);
                }
            }
        }

        // امتیاز اضافی برای محصولات محبوب (تا 10% اضافه)
        const popularityBonus =
            Math.min(0.05, (product.total_views || 0) / 10000) +        // بازدید
            Math.min(0.03, (product.total_likes || 0) / 1000) +         // لایک
            Math.min(0.02, (product.total_saves || 0) / 500);           // ذخیره

        score += popularityBonus;

        // امتیاز برای محصولات جدید (تا 5% اضافه)
        const daysOld = Math.floor((new Date().getTime() - product.created_at.getTime()) / (1000 * 60 * 60 * 24));
        const recencyBonus = Math.max(0, (30 - daysOld) / 30) * 0.05;
        score += recencyBonus;

        // امتیاز برای محصولات بوست شده (تا 5% اضافه)
        if (product.boost_purchased && product.boost_expires_at > new Date()) {
            score += 0.05;
        }

        return Math.min(1, Math.max(0, score));
    }

    private calculatePriceSensitivity(pricePoints: number[]): string {
        if (pricePoints.length === 0) {
            return 'unknown';
        }

        const averagePrice = pricePoints.reduce((sum, price) => sum + price, 0) / pricePoints.length;
        const priceVariance = pricePoints.reduce((sum, price) => sum + Math.pow(price - averagePrice, 2), 0) / pricePoints.length;
        const priceStdDev = Math.sqrt(priceVariance);

        // طبقه‌بندی حساسیت قیمتی بر اساس میانگین و انحراف معیار
        if (averagePrice < 1000000) { // کمتر از 1 میلیون
            return priceStdDev < 200000 ? 'low' : 'medium';
        } else if (averagePrice < 5000000) { // 1 تا 5 میلیون
            return priceStdDev < 500000 ? 'medium' : 'high';
        } else if (averagePrice < 20000000) { // 5 تا 20 میلیون
            return priceStdDev < 1000000 ? 'high' : 'premium';
        } else { // بیشتر از 20 میلیون
            return 'premium';
        }
    }


    private determinePrimaryFactors(topCategories: any[], topBrands: any[]): string[] {
        const factors: string[] = [];

        // تحلیل قدرت ترجیحات دسته‌بندی
        if (topCategories.length > 0) {
            const topCategoryScore = topCategories[0].score;
            if (topCategoryScore > 50) factors.push('strong_category_preference');
            else if (topCategoryScore > 20) factors.push('moderate_category_preference');
        }

        // تحلیل قدرت ترجیحات برند
        if (topBrands.length > 0) {
            const topBrandScore = topBrands[0].score;
            if (topBrandScore > 30) factors.push('strong_brand_preference');
            else if (topBrandScore > 10) factors.push('moderate_brand_preference');
        }

        // تحلیل تنوع علاقه‌مندی‌ها
        if (topCategories.length >= 3) factors.push('diverse_interests');
        if (topBrands.length >= 3) factors.push('brand_explorer');

        // تحلیل عمق علاقه‌مندی‌ها
        if (topCategories.length === 1 && topCategories[0].score > 80) {
            factors.push('specialized_interest');
        }

        return factors.length > 0 ? factors : ['general_interest'];
    }


    private calculateActivityLevel(activities: any[]): string {
        const activityCount = activities.length;

        if (activityCount === 0) return 'inactive';
        if (activityCount < 10) return 'light';
        if (activityCount < 50) return 'moderate';
        if (activityCount < 200) return 'active';
        return 'very_active';
    }


    private calculateActivityLevelFromCount(activityCount: number): string {
        if (activityCount === 0) return 'inactive';
        if (activityCount < 10) return 'light';
        if (activityCount < 50) return 'moderate';
        if (activityCount < 200) return 'active';
        return 'very_active';
    }

    private extractProductFeatures(products: any[]): any {
        const features = {
            categories: [] as string[],
            brands: [] as string[],
            price_points: [] as number[],
            price_range: { min: 0, max: 0 }
        };

        products.forEach(product => {
            const content = product.contents?.[0];
            const primaryPrice = product.pricing_strategies?.[0];

            if (content?.category_name) {
                features.categories.push(content.category_name);
            }
            if (content?.brand_name) {
                features.brands.push(content.brand_name);
            }
            if (primaryPrice?.final_price_amount) {
                features.price_points.push(primaryPrice.final_price_amount);
            }
        });

        // محاسبه محدوده قیمت
        if (features.price_points.length > 0) {
            features.price_range = {
                min: Math.min(...features.price_points),
                max: Math.max(...features.price_points)
            };
        }

        // حذف مقادیر تکراری
        features.categories = [...new Set(features.categories)];
        features.brands = [...new Set(features.brands)];

        return features;
    }
    // ==================== محصولات تکمیل‌کننده سبد خرید ====================
    async getComplementaryProducts(productId: string, options: {
        limit?: number;
        language?: Language;
        accountUserId?: string;
    } = {}): Promise<{ products: any[]; complementarity: any }> {
        const {
            limit = 8,
            language = Language.fa,
            accountUserId
        } = options;

        const cacheKey = `complementary:${productId}:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any;
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        try {
            const product = await this.prisma.product.findUnique({
                where: { id: productId },
                select: {
                    category_id: true,
                    sub_category_id: true,
                    // استفاده از join با ProductPrice برای قیمت
                    pricing_strategies: {
                        where: {
                            is_active: true,
                            is_primary: true
                        },
                        take: 1,
                        select: {
                            final_price_amount: true
                        }
                    },
                    contents: {
                        where: { language },
                        select: {
                            name: true,
                            brand_name: true,
                            category_name: true,
                            tags: true
                        }
                    },
                    category: {
                        select: {
                            contents: {
                                where: { language },
                                select: { name: true }
                            }
                        }
                    }
                }
            });

            if (!product) {
                throw new NotFoundException('محصول یافت نشد');
            }

            let complementaryWhere: Prisma.ProductWhereInput = {
                id: { not: productId },
                status: ProductStatus.APPROVED,
                confirmed: true,
                files: {
                    some: {
                        file_usage: FileUsage.PRODUCT_IMAGE,
                        status: "2"
                    }
                }
            };

            // اگر اطلاعات کاربر موجود باشد، شخصی‌سازی پیشرفته
            if (accountUserId) {
                const userProfile = await this.getUserBehaviorProfile(accountUserId, language);
                complementaryWhere = this.applyUserPreferencesToComplementary(
                    complementaryWhere,
                    userProfile,
                    product
                );
            } else {
                // الگوریتم پایه برای کاربران ناشناس
                complementaryWhere = this.applyBasicComplementaryLogic(complementaryWhere, product);
            }

            const products = await this.prisma.product.findMany({
                where: complementaryWhere,
                take: limit,
                include: this.getPersonalizedProductInclude(language),
                orderBy: [
                    { boost_purchased: 'desc' },
                    { total_views: 'desc' },
                    { created_at: 'desc' }
                ],
            });

            const enrichedProducts = products.map(p =>
                this.enrichPersonalizedProduct(p, language)
            );

            const result = {
                products: enrichedProducts,
                complementarity: {
                    based_on_product: product.contents[0]?.name,
                    category: product.category?.contents[0]?.name,
                    logic: accountUserId ? 'personalized' : 'basic',
                    factors: this.getComplementarityFactors(product, enrichedProducts)
                }
            };

            try {
                await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000); // 30 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return result;
        } catch (error) {
            console.error('Error in getComplementaryProducts:', error);
            throw error;
        }
    }

    private getPriceRangeForSensitivity(sensitivity: string): { min: number; max: number } {
        switch (sensitivity) {
            case 'low':
                return { min: 0, max: 1000000 }; // تا 1 میلیون
            case 'medium':
                return { min: 500000, max: 5000000 }; // 500 هزار تا 5 میلیون
            case 'high':
                return { min: 2000000, max: 20000000 }; // 2 میلیون تا 20 میلیون
            case 'premium':
                return { min: 5000000, max: 100000000 }; // 5 میلیون تا 100 میلیون
            default:
                return { min: 0, max: 10000000 }; // پیش‌فرض تا 10 میلیون
        }
    }
    private applyUserPreferencesToComplementary(
        where: Prisma.ProductWhereInput,
        userProfile: any,
        baseProduct: any
    ): Prisma.ProductWhereInput {

        const updatedWhere: Prisma.ProductWhereInput = { ...where };

        // اعمال ترجیحات قیمتی کاربر
        if (userProfile.preferences.price_sensitivity !== 'unknown') {
            const priceRange = this.getPriceRangeForSensitivity(userProfile.preferences.price_sensitivity);
            updatedWhere.pricing_strategies = {
                some: {
                    is_active: true,
                    is_primary: true,
                    final_price_amount: {
                        gte: priceRange.min,
                        lte: priceRange.max
                    }
                }
            };
        }

        // اعمال ترجیحات دسته‌بندی کاربر (محصولات مرتبط اما نه دقیقاً هم‌دسته)
        if (userProfile.preferences.categories.length > 0) {
            const preferredCategories = userProfile.preferences.categories
                .filter((cat: any) => cat.name !== baseProduct.contents[0]?.category_name)
                .slice(0, 3);

            if (preferredCategories.length > 0) {
                updatedWhere.OR = preferredCategories.map((cat: any) => ({
                    contents: {
                        some: {
                            category_name: { contains: cat.name, mode: 'insensitive' }
                        }
                    }
                }));
            }
        }

        // اعمال ترجیحات برندی کاربر
        if (userProfile.preferences.brands.length > 0) {
            const preferredBrands = userProfile.preferences.brands
                .filter((brand: any) => brand.name !== baseProduct.contents[0]?.brand_name)
                .slice(0, 2);

            if (preferredBrands.length > 0) {
                updatedWhere.OR = [
                    ...(updatedWhere.OR as any[] || []),
                    ...preferredBrands.map((brand: any) => ({
                        contents: {
                            some: {
                                brand_name: { contains: brand.name, mode: 'insensitive' }
                            }
                        }
                    }))
                ];
            }
        }

        return updatedWhere;
    }
    private applyBasicComplementaryLogic(
        where: Prisma.ProductWhereInput,
        baseProduct: any
    ): Prisma.ProductWhereInput {

        const updatedWhere: Prisma.ProductWhereInput = { ...where };

        // محصولات از دسته‌بندی‌های مرتبط اما متفاوت
        if (baseProduct.category_id) {
            updatedWhere.OR = [
                // محصولات از همان دسته‌بندی اصلی اما زیردسته‌های مختلف
                {
                    category_id: baseProduct.category_id,
                    sub_category_id: { not: baseProduct.sub_category_id }
                },
                // محصولات از دسته‌بندی‌های مرتبط
                {
                    contents: {
                        some: {
                            category_name: {
                                contains: baseProduct.contents[0]?.category_name?.split(' ')[0] || '',
                                mode: 'insensitive'
                            }
                        }
                    }
                }
            ];
        }

        // محدوده قیمتی مکمل (معمولاً قیمت پایین‌تر یا مشابه)
        const basePrice = baseProduct.pricing_strategies?.[0]?.final_price_amount;
        if (basePrice) {
            updatedWhere.pricing_strategies = {
                some: {
                    is_active: true,
                    is_primary: true,
                    final_price_amount: {
                        gte: Math.max(0, basePrice * 0.3),  // حداقل 30% قیمت محصول اصلی
                        lte: basePrice * 1.5  // حداکثر 150% قیمت محصول اصلی
                    }
                }
            };
        }

        // محصولات با برندهای مختلف از همان دسته‌بندی
        if (baseProduct.contents[0]?.brand_name) {
            updatedWhere.NOT = {
                contents: {
                    some: {
                        brand_name: baseProduct.contents[0].brand_name
                    }
                }
            };
        }

        return updatedWhere;
    }
    private getComplementarityFactors(baseProduct: any, complementaryProducts: any[]): any {
        const factors = {
            category_diversity: 0,
            price_compatibility: 0,
            brand_diversity: 0,
            overall_score: 0
        };

        const baseCategory = baseProduct.contents[0]?.category_name;
        const baseBrand = baseProduct.contents[0]?.brand_name;
        const basePrice = baseProduct.pricing_strategies?.[0]?.final_price_amount;

        let categoryMatches = 0;
        let brandMatches = 0;
        let priceCompatible = 0;

        complementaryProducts.forEach(product => {
            const productCategory = product.contents?.[0]?.category_name;
            const productBrand = product.contents?.[0]?.brand_name;
            const productPrice = product.pricing_strategies?.[0]?.final_price_amount;

            // تنوع دسته‌بندی
            if (productCategory && productCategory !== baseCategory) {
                categoryMatches++;
            }

            // تنوع برند
            if (productBrand && productBrand !== baseBrand) {
                brandMatches++;
            }

            // سازگاری قیمتی
            if (productPrice && basePrice) {
                const priceRatio = productPrice / basePrice;
                if (priceRatio >= 0.3 && priceRatio <= 1.5) {
                    priceCompatible++;
                }
            }
        });

        factors.category_diversity = categoryMatches / complementaryProducts.length;
        factors.brand_diversity = brandMatches / complementaryProducts.length;
        factors.price_compatibility = priceCompatible / complementaryProducts.length;
        factors.overall_score = (factors.category_diversity + factors.brand_diversity + factors.price_compatibility) / 3;

        return factors;
    }
    // ==================== محصولات بر اساس فصل و موقعیت ====================
    async getSeasonalProducts(accountUserId: string, options: {
        limit?: number;
        language?: Language;
        season?: string;
        location_level_2_id?: string;
    } = {}): Promise<{ products: any[]; seasonality: any }> {
        const {
            limit = 12,
            language = Language.fa,
            season,
            location_level_2_id
        } = options;

        // از season استفاده نمی‌کنیم، فقط برای سازگاری نگه می‌داریم
        const currentSeason = season || 'general';
        const cacheKey = `seasonal:${accountUserId}:${currentSeason}:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any;
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        try {
            // دریافت ترجیحات کاربر (بدون وابستگی به فصل)
            const userPreferences = await this.getUserBehaviorProfile(accountUserId, language);

            // ساخت کوئری بر اساس ترجیحات کاربر
            const where = this.buildSeasonalWhereClause(
                userPreferences,
                location_level_2_id
            );

            const products = await this.prisma.product.findMany({
                where,
                take: limit,
                include: this.getPersonalizedProductInclude(language),
                orderBy: this.buildSeasonalOrderBy(userPreferences),
            });

            const enrichedProducts = products.map(p =>
                this.enrichPersonalizedProduct(p, language)
            );

            const result = {
                products: enrichedProducts,
                seasonality: {
                    season: currentSeason,
                    location_specific: !!location_level_2_id,
                    user_preferences: userPreferences.preferences.categories.slice(0, 3).map((c: any) => c.name),
                    confidence: userPreferences.confidence_score
                }
            };

            try {
                await this.cacheManager.set(cacheKey, result, 60 * 60 * 1000); // 1 hour cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return result;
        } catch (error) {
            console.error('Error in getSeasonalProducts:', error);
            throw error;
        }
    }

    private buildSeasonalWhereClause(
        userPreferences: any,
        location_level_2_id?: string
    ): Prisma.ProductWhereInput {

        const where: Prisma.ProductWhereInput = {
            status: ProductStatus.APPROVED,
            confirmed: true,
            files: {
                some: {
                    file_usage: FileUsage.PRODUCT_IMAGE,
                    status: "2"
                }
            }
        };

        // اعمال ترجیحات کاربر
        if (userPreferences.preferences.categories.length > 0) {
            const topCategories = userPreferences.preferences.categories
                .slice(0, 3)
                .map((cat: any) => cat.name);

            where.OR = topCategories.map((category: string) => ({
                contents: {
                    some: {
                        category_name: { contains: category, mode: 'insensitive' }
                    }
                }
            }));
        }

        // فیلتر قیمت بر اساس حساسیت کاربر
        if (userPreferences.preferences.price_sensitivity !== 'unknown') {
            const priceRange = this.getPriceRangeForSensitivity(userPreferences.preferences.price_sensitivity);
            where.pricing_strategies = {
                some: {
                    is_active: true,
                    is_primary: true,
                    final_price_amount: {
                        gte: priceRange.min,
                        lte: priceRange.max
                    }
                }
            };
        }

        // فیلتر لوکیشن اگر مشخص شده باشد
        if (location_level_2_id) {
            where.location_level_2_id = location_level_2_id;
        }

        return where;
    }


    private buildSeasonalOrderBy(userPreferences: any): any[] {
        const orderBy: any[] = [];

        // برای کاربران با داده کافی، اولویت با ترجیحات شخصی
        if (userPreferences.confidence_score > 0.7) {
            orderBy.push(
                { boost_purchased: 'desc' },
                { total_views: 'desc' },
                { total_likes: 'desc' }
            );
        } else {
            // برای کاربران جدید، ترکیبی از محبوبیت و تازگی
            orderBy.push(
                { boost_purchased: 'desc' },
                { total_views: 'desc' },
                { created_at: 'desc' }
            );
        }

        return orderBy;
    }

    private getCurrentSeason(): string {
        // از آنجایی که از فصل استفاده نمی‌کنیم، همیشه general برمی‌گردانیم
        return 'general';
    }

    private async getUserSeasonalPreferences(accountUserId: string, season: string): Promise<any> {
        // استفاده از پروفایل رفتار کاربر به جای تحلیل فصلی
        const userProfile = await this.getUserBehaviorProfile(accountUserId, Language.fa);

        return {
            preferences: userProfile.preferences.categories.slice(0, 5).map((c: any) => c.name),
            confidence: userProfile.confidence_score,
            seasonal_patterns: []
        };
    }

    private async calculateRecommendationEffectiveness(accountUserId: string): Promise<number> {
        try {
            // تحلیل اینکه چند درصد از پیشنهادات منجر به تعامل شده‌اند
            const recommendations = await this.prisma.accountUserActivity.findMany({
                where: {
                    account_user_id: accountUserId,
                    activity_type: {
                        in: [UserActivityType.PRODUCT_VIEW, UserActivityType.PRODUCT_LIKE, UserActivityType.PRODUCT_SAVE]
                    },
                    created_at: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 روز گذشته
                    }
                }
            });

            if (recommendations.length === 0) return 0.5; // پیش‌فرض

            const effectiveInteractions = recommendations.filter(activity =>
                activity.activity_type === UserActivityType.PRODUCT_LIKE ||
                activity.activity_type === UserActivityType.PRODUCT_SAVE
            ).length;

            return Math.min(1, effectiveInteractions / recommendations.length);
        } catch (error) {
            console.error('Error calculating recommendation effectiveness:', error);
            return 0.5;
        }
    }

    private generateImprovementSuggestions(userProfile: any): string[] {
        const suggestions: string[] = [];

        if (userProfile.insufficiency_score > 0.7) {
            suggestions.push('برای دریافت پیشنهادات بهتر، محصولات بیشتری را مشاهده کنید');
            suggestions.push('با لایک کردن محصولات، علاقه‌مندی‌های خود را مشخص کنید');
        }

        if (userProfile.confidence_score < 0.5) {
            suggestions.push('جستجوهای بیشتری انجام دهید تا الگوریتم شما را بهتر بشناسد');
        }

        if (userProfile.preferences.categories.length < 2) {
            suggestions.push('محصولات از دسته‌بندی‌های متنوع تری را بررسی کنید');
        }

        if (userProfile.activity_level === 'light') {
            suggestions.push('فعالیت بیشتری در پلتفرم داشته باشید تا پیشنهادات شخصی‌تری دریافت کنید');
        }

        return suggestions.length > 0 ? suggestions : ['پیشنهادات شما در حال حاضر بهینه است'];
    }




    // ==================== محصولات برای شما (For You) - ترکیب الگوریتم‌ها ====================
    async getForYouProducts(accountUserId: string, options: {
        limit?: number;
        language?: Language;
        algorithm_mix?: {
            personalized?: number;
            similar?: number;
            complementary?: number;
            seasonal?: number;
            trending?: number;
        };
    } = {}): Promise<{ products: any[]; algorithm_breakdown: any }> {
        const {
            limit = 24,
            language = Language.fa,
            algorithm_mix = {
                personalized: 0.4,
                similar: 0.2,
                complementary: 0.2,
                seasonal: 0.1,
                trending: 0.1
            }
        } = options;

        const cacheKey = `foryou:${accountUserId}:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any;
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        try {
            // اجرای موازی تمام الگوریتم‌ها
            const [
                personalizedResults,
                similarResults,
                complementaryResults,
                seasonalResults,
                trendingResults
            ] = await Promise.all([
                this.getPersonalizedRecommendations(accountUserId, { limit: 20, language }),
                this.getSimilarToViewed(accountUserId, { limit: 15, language }),
                this.getComplementaryFromHistory(accountUserId, { limit: 15, language }),
                this.getSeasonalProducts(accountUserId, { limit: 10, language }),
                this.getTrendingPersonalized(accountUserId, { limit: 10, language })
            ]);

            // ترکیب و رتبه‌بندی نتایج
            const combinedProducts = this.combineAlgorithmResults({
                personalized: personalizedResults.products,
                similar: similarResults.products,
                complementary: complementaryResults.products,
                seasonal: seasonalResults.products,
                trending: trendingResults.products
            }, algorithm_mix, limit);

            const result = {
                products: combinedProducts,
                algorithm_breakdown: {
                    personalized: {
                        count: personalizedResults.products.length,
                        confidence: personalizedResults.recommendations.confidence
                    },
                    similar: {
                        count: similarResults.products.length,
                        based_on: similarResults.based_on
                    },
                    complementary: {
                        count: complementaryResults.products.length,
                        logic: complementaryResults.complementarity.logic
                    },
                    seasonal: {
                        count: seasonalResults.products.length,
                        season: seasonalResults.seasonality.season
                    },
                    trending: {
                        count: trendingResults.products.length
                    },
                    final_mix: algorithm_mix
                }
            };

            try {
                await this.cacheManager.set(cacheKey, result, 20 * 60 * 1000); // 20 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return result;
        } catch (error) {
            console.error('Error in getForYouProducts:', error);
            // Fallback to personalized recommendations
            const fallback = await this.getPersonalizedRecommendations(accountUserId, {
                limit,
                language
            });
            return {
                products: fallback.products,
                algorithm_breakdown: {
                    fallback: true,
                    reason: 'error_in_algorithm_mix'
                }
            };
        }
    }

    // ==================== به‌روزرسانی پروفایل کاربر بر اساس فعالیت جدید ====================
    async updateUserProfile(accountUserId: string, activity: {
        type: UserActivityType;
        product_id: string;
        metadata?: any;
        weight?: number;
    }): Promise<void> {
        try {
            // ثبت فعالیت
            await this.prisma.accountUserActivity.create({
                data: {
                    account_user_id: accountUserId,
                    activity_type: activity.type,
                    product_id: activity.product_id,
                    metadata: activity.metadata || {},
                    weight: activity.weight || this.getActivityWeight(activity.type)
                }
            });

            // به‌روزرسانی رفتار کاربر
            //await   this.activityService.update(accountUserId, activity);

            // پاکسازی کش‌های مربوطه
            await this.clearPersonalizationCaches(accountUserId);
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    // ==================== دریافت بینش‌های شخصی‌سازی ====================
    async getPersonalizationInsights(accountUserId: string, language: Language = Language.fa): Promise<any> {
        try {
            const userProfile = await this.getUserBehaviorProfile(accountUserId, language);
            const recentActivities = await this.getRecentActivities(accountUserId, 50);

            return {
                user_profile: {
                    segment: userProfile.segment,
                    confidence_score: userProfile.confidence_score,
                    data_sufficiency: 1 - userProfile.insufficiency_score,
                    primary_interests: userProfile.primary_factors,
                    activity_level: this.calculateActivityLevel(recentActivities)
                },
                preferences: {
                    favorite_categories: userProfile.preferences.categories,
                    favorite_brands: userProfile.preferences.brands,
                    price_sensitivity: userProfile.preferences.price_sensitivity,
                    preferred_locations: userProfile.preferences.locations
                },
                recommendations_effectiveness: await this.calculateRecommendationEffectiveness(accountUserId),
                improvement_suggestions: this.generateImprovementSuggestions(userProfile)
            };
        } catch (error) {
            console.error('Error getting personalization insights:', error);
            throw error;
        }
    }
    private async getRecentActivities(accountUserId: string, limit: number = 50): Promise<any[]> {
        try {
            const activities = await this.prisma.accountUserActivity.findMany({
                where: {
                    account_user_id: accountUserId,
                    created_at: {
                        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 روز گذشته
                    }
                },
                include: {
                    product: {
                        select: {
                            id: true,
                            contents: {
                                select: {
                                    name: true,
                                    category_name: true
                                }
                            }
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: limit
            });

            return activities;
        } catch (error) {
            console.error('Error getting recent activities:', error);
            return [];
        }
    }
    // ==================== متدهای کمکی پیشرفته ====================

    private async getUserBehaviorProfile(accountUserId: string, language: Language): Promise<any> {
        // دریافت فعالیت‌های کاربر
        const activities = await this.prisma.accountUserActivity.findMany({
            where: {
                account_user_id: accountUserId,
                created_at: {
                    gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 روز گذشته
                }
            },
            include: {
                product: {
                    include: {
                        contents: {
                            where: { language },
                            select: {
                                category_name: true,
                                brand_name: true,
                                name: true
                            }
                        },
                        category: {
                            select: {
                                contents: {
                                    where: { language },
                                    select: { name: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { created_at: 'desc' },
            take: 1000
        });

        return this.analyzeUserBehavior(activities, language);
    }

    private analyzeUserBehavior(activities: any[], language: Language): any {
        if (activities.length === 0) {
            return {
                insufficiency_score: 1.0,
                confidence_score: 0.1,
                segment: 'new_user',
                primary_factors: [],
                preferences: {
                    categories: [],
                    brands: [],
                    price_sensitivity: 'unknown',
                    locations: []
                }
            };
        }

        // تحلیل پیشرفته رفتار کاربر
        const analysis = {
            categories: new Map<string, number>(),
            brands: new Map<string, number>(),
            price_points: [] as number[],
            locations: new Map<string, number>(),
            activity_types: new Map<string, number>(),
            time_patterns: {} as any
        };

        activities.forEach(activity => {
            const product = activity.product;
            const content = product?.contents?.[0];

            // تحلیل دسته‌بندی‌ها
            if (content?.category_name) {
                analysis.categories.set(
                    content.category_name,
                    (analysis.categories.get(content.category_name) || 0) + activity.weight
                );
            }

            // تحلیل برندها
            if (content?.brand_name) {
                analysis.brands.set(
                    content.brand_name,
                    (analysis.brands.get(content.brand_name) || 0) + activity.weight
                );
            }

            // تحلیل قیمت
            if (product?.calculated_min_price) {
                analysis.price_points.push(product.calculated_min_price);
            }

            // تحلیل انواع فعالیت
            analysis.activity_types.set(
                activity.activity_type,
                (analysis.activity_types.get(activity.activity_type) || 0) + 1
            );
        });

        return this.compileUserProfile(analysis, activities.length, language);
    }

    private compileUserProfile(analysis: any, activityCount: number, language: Language): any {
        const topCategories = Array.from(analysis.categories.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, score]) => ({ name, score }));

        const topBrands = Array.from(analysis.brands.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, score]) => ({ name, score }));

        const priceSensitivity = this.calculatePriceSensitivity(analysis.price_points);
        const activityLevel = this.calculateActivityLevelFromCount(activityCount);

        return {
            insufficiency_score: Math.max(0, 1 - (activityCount / 100)), // هرچه فعالیت بیشتر، اطلاعات کافی‌تر
            confidence_score: Math.min(1, activityCount / 50),
            segment: this.determineUserSegment(analysis, activityCount),
            primary_factors: this.determinePrimaryFactors(topCategories, topBrands),
            preferences: {
                categories: topCategories,
                brands: topBrands,
                price_sensitivity: priceSensitivity,
                locations: Array.from(analysis.locations.entries())
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3)
            }
        };
    }
    private determineUserSegment(analysis: any, activityCount: number): string {
        // تحلیل سطح فعالیت
        if (activityCount < 5) return 'new_user';
        if (activityCount < 20) return 'casual_user';
        if (activityCount < 100) return 'active_user';

        // تحلیل تنوع علاقه‌مندی‌ها
        const categoryDiversity = analysis.categories.size;
        const brandDiversity = analysis.brands.size;

        if (categoryDiversity > 8 && brandDiversity > 5) {
            return 'explorer';
        } else if (categoryDiversity <= 3 && brandDiversity <= 2) {
            return 'loyalist';
        } else if (analysis.activity_types.get('PRODUCT_COMPARE') > 10) {
            return 'researcher';
        } else if (analysis.activity_types.get('PRODUCT_SAVE') > 15) {
            return 'collector';
        }

        return 'standard_user';
    }



    private buildPersonalizedWhereClause(userProfile: any, excludeViewed: boolean): Prisma.ProductWhereInput {
        const where: Prisma.ProductWhereInput = {
            status: ProductStatus.APPROVED,
            confirmed: true,
            files: {
                some: {
                    file_usage: FileUsage.PRODUCT_IMAGE,
                    status: "2"
                }
            }
        };

        // اعمال ترجیحات کاربر
        if (userProfile.preferences.categories.length > 0) {
            where.OR = userProfile.preferences.categories.map((cat: any) => ({
                contents: {
                    some: {
                        category_name: { contains: cat.name, mode: 'insensitive' }
                    }
                }
            }));
        }

        // فیلتر بر اساس حساسیت قیمتی - استفاده از join با ProductPrice
        if (userProfile.preferences.price_sensitivity !== 'unknown') {
            const priceRange = this.getPriceRangeForSensitivity(userProfile.preferences.price_sensitivity);
            where.pricing_strategies = {
                some: {
                    is_active: true,
                    is_primary: true,
                    final_price_amount: {
                        gte: priceRange.min,
                        lte: priceRange.max
                    }
                }
            };
        }

        // حذف محصولات دیده شده
        if (excludeViewed && userProfile.viewed_products) {
            where.id = {
                notIn: userProfile.viewed_products
            };
        }

        return where;
    }

    private buildPersonalizedOrderBy(userProfile: any, diversity_factor: number): any[] {
        const orderBy: any[] = [];

        // اولویت‌بندی بر اساس ترجیحات کاربر
        if (userProfile.confidence_score > 0.7) {
            orderBy.push({ boost_purchased: 'desc' });
            orderBy.push({ total_views: 'desc' });
        } else {
            // برای کاربران جدید، ترکیبی از محبوبیت و تازگی
            orderBy.push(
                { boost_purchased: 'desc' },
                { total_views: 'desc' },
                { created_at: 'desc' }
            );
        }

        return orderBy;
    }

    private async scoreProductsForUser(products: any[], userProfile: any, language: Language): Promise<any[]> {
        return products.map(product => {
            let score = 0;
            const content = product.contents?.[0];
            const primaryPrice = product.pricing_strategies?.[0];

            // امتیازدهی بر اساس دسته‌بندی
            const categoryMatch = userProfile.preferences.categories.find((cat: any) =>
                content?.category_name?.toLowerCase().includes(cat.name.toLowerCase())
            );
            if (categoryMatch) {
                score += categoryMatch.score * 10;
            }

            // امتیازدهی بر اساس برند
            const brandMatch = userProfile.preferences.brands.find((brand: any) =>
                content?.brand_name?.toLowerCase().includes(brand.name.toLowerCase())
            );
            if (brandMatch) {
                score += brandMatch.score * 8;
            }

            // امتیازدهی بر اساس قیمت - استفاده از ProductPrice
            let priceScore = 0;
            if (userProfile.preferences.price_sensitivity !== 'unknown' && primaryPrice?.final_price_amount) {
                priceScore = this.calculatePriceScore(
                    primaryPrice.final_price_amount,
                    userProfile.preferences.price_sensitivity
                );
                score += priceScore * 6;
            }

            // امتیازدهی بر اساس محبوبیت
            score += Math.log(product.total_views + 1) * 2;
            score += product.total_likes * 3;
            score += product.total_saves * 4;

            // امتیازدهی بر اساس تازگی
            const daysOld = Math.floor((new Date().getTime() - product.created_at.getTime()) / (1000 * 60 * 60 * 24));
            score += Math.max(0, 30 - daysOld) * 0.1;

            return {
                ...product,
                personalization_score: Math.round(score * 100) / 100,
                match_factors: {
                    category: !!categoryMatch,
                    brand: !!brandMatch,
                    price: priceScore > 0
                }
            };
        });
    }
    private calculatePriceScore(price: number, sensitivity: string): number {
        if (!price) return 0;

        const range = this.getPriceRangeForSensitivity(sensitivity);

        // اگر قیمت دقیقاً در محدوده باشد
        if (price >= range.min && price <= range.max) {
            return 1.0;
        }

        // محاسبه امتیاز بر اساس فاصله از محدوده
        if (price < range.min) {
            const distance = range.min - price;
            const rangeSize = range.max - range.min;
            // اگر محدوده خیلی کوچک باشد، از محدوده پیش‌فرض استفاده کن
            const effectiveRangeSize = rangeSize > 0 ? rangeSize : 1000000;
            return Math.max(0, 1 - (distance / effectiveRangeSize));
        } else {
            const distance = price - range.max;
            const rangeSize = range.max - range.min;
            const effectiveRangeSize = rangeSize > 0 ? rangeSize : 1000000;
            return Math.max(0, 1 - (distance / effectiveRangeSize));
        }
    }
    private diversifyRecommendations(products: any[], diversity_factor: number, limit: number): any[] {
        if (products.length <= limit) {
            return products.sort((a, b) => b.personalization_score - a.personalization_score);
        }

        // الگوریتم تنوع‌بخشی
        const selected: any[] = [];
        const categoriesCovered = new Set();
        const brandsCovered = new Set();

        // اول محصولات با امتیاز بالا
        const sortedProducts = products.sort((a, b) => b.personalization_score - a.personalization_score);

        for (const product of sortedProducts) {
            if (selected.length >= limit) break;

            const content = product.contents?.[0];
            const category = content?.category_name;
            const brand = content?.brand_name;

            const isDiverse = !categoriesCovered.has(category) || !brandsCovered.has(brand);

            if (isDiverse || Math.random() < diversity_factor) {
                selected.push(product);
                if (category) categoriesCovered.add(category);
                if (brand) brandsCovered.add(brand);
            }
        }

        return selected;
    }

    private getPersonalizedProductInclude(language: Language) {
        return {
            account: {
                select: {
                    id: true,
                    name: true,
                    activity_type: true,
                    profile_photo: true,
                    confirmed: true,
                    contents: {
                        where: { language },
                        select: { name: true }
                    }
                }
            },
            contents: {
                where: { language },
                select: {
                    name: true,
                    description: true,
                    brand_name: true,
                    category_name: true,
                    tags: true
                }
            },
            _count: {
                select: {
                    reviews: { where: { confirmed: true } },
                    interactions: true,
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
            }
        };
    }

    private enrichPersonalizedProduct(product: any, language: Language) {
        const baseProduct = this.enrichPublicProduct(product, language);

        return {
            ...baseProduct,
            personalization_score: product.personalization_score,
            match_factors: product.match_factors,
            explanation: this.generateExplanation(product, language)
        };
    }

    // ... ادامه پیاده‌سازی سایر متدهای کمکی

    private getActivityWeight(activityType: UserActivityType): number {
        const weights = {
            [UserActivityType.PRODUCT_VIEW]: 1,
            [UserActivityType.PRODUCT_LIKE]: 3,
            [UserActivityType.PRODUCT_SAVE]: 4,
            [UserActivityType.PRODUCT_COMPARE]: 2,
            [UserActivityType.SEARCH_QUERY]: 2,
            [UserActivityType.SEARCH_FILTER]: 1,
            [UserActivityType.PROFILE_UPDATE]: 1
        };

        return weights[activityType] || 1;
    }



    // ... سایر متدهای کمکی که در کد اصلی اشاره شده بود

    private async getFallbackRecommendations(limit: number, language: Language): Promise<any[]> {
        // بازگشت به محصولات محبوب زمانی که داده کافی نیست
        const popularProducts = await this.prisma.product.findMany({
            where: {
                status: ProductStatus.APPROVED,
                confirmed: true,
                files: {
                    some: {
                        file_usage: FileUsage.PRODUCT_IMAGE,
                        status: "2"
                    }
                }
            },
            take: limit,
            include: this.getPersonalizedProductInclude(language),
            orderBy: [
                { total_views: 'desc' },
                { total_likes: 'desc' },
                { created_at: 'desc' }
            ],
        });

        return popularProducts.map(p => this.enrichPersonalizedProduct(p, language));
    }

    private async getComplementaryFromHistory(accountUserId: string, options: { limit: number; language: Language }) {
        // پیاده‌سازی محصولات تکمیل‌کننده بر اساس تاریخچه
        // این یک پیاده‌سازی ساده است
        return { products: [], complementarity: { logic: 'history_based' } };
    }

    private async getTrendingPersonalized(accountUserId: string, options: { limit: number; language: Language }) {
        // پیاده‌سازی محصولات ترند با در نظر گرفتن علاقه‌مندی‌های کاربر
        return { products: [] };
    }

    private combineAlgorithmResults(results: any, mix: any, limit: number): any[] {
        // ترکیب هوشمندانه نتایج الگوریتم‌های مختلف
        const allProducts = new Map();

        Object.entries(results).forEach(([algorithm, algorithmResults]) => {
            const weight = mix[algorithm] || 0.1;

            // مشخص کردن نوع برای algorithmResults
            const productsArray = algorithmResults as any[];

            if (Array.isArray(productsArray)) {
                productsArray.forEach((product: any, index: number) => {
                    const existing = allProducts.get(product.id);
                    const rankScore = (productsArray.length - index) / productsArray.length;

                    if (existing) {
                        existing.score += weight * rankScore;
                    } else {
                        allProducts.set(product.id, {
                            ...product,
                            score: weight * rankScore,
                            algorithms: [algorithm]
                        });
                    }
                });
            }
        });

        return Array.from(allProducts.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    private generateExplanation(product: any, language: Language): string {
        // تولید توضیح هوشمند برای توصیه
        const factors = product.match_factors;
        const explanations = [];

        if (factors.category) {
            explanations.push('با علاقه‌مندی‌های شما در این دسته‌بندی مطابقت دارد');
        }
        if (factors.brand) {
            explanations.push('از برندهای مورد علاقه شماست');
        }
        if (factors.price) {
            explanations.push('در محدوده قیمتی مناسب شما قرار دارد');
        }

        return explanations.length > 0
            ? explanations.join(' و ')
            : 'محصول پرطرفدار و باکیفیت';
    }
}