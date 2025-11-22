// src/services/product/ProductPublicService.ts
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import {
    PrismaClient,
    ProductStatus,
    Language,
    InteractionType,
    FileUsage,
    Prisma
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ProductBaseService } from "./product.base.service";
import { I18nNotFoundException } from '../../common/exceptions/i18n-exceptions';
import {PrismaService} from "../../prisma/prisma.service";

@Injectable()
export class ProductPublicService extends ProductBaseService {
    constructor(
        protected prisma: PrismaService,
        @Inject(CACHE_MANAGER) protected cacheManager: Cache,

    ) {
        super(prisma, cacheManager); // ارسال prisma به parent
    }

    // ==================== دریافت محصولات فعال برای عموم ====================
    async getActiveProducts(options: {
        page?: number;
        limit?: number;
        category_id?: string;
        sub_category_id?: string;
        location_level_1_id?: string;
        location_level_2_id?: string;
        location_level_3_id?: string;
        min_price?: number;
        max_price?: number;
        search?: string;
        sort_by?: string;
        language?: Language;
    }): Promise<{ products: any[]; total: number; page: number; totalPages: number }> {
        const {
            page = 1,
            limit = 12,
            category_id,
            sub_category_id,
            location_level_1_id,
            location_level_2_id,
            location_level_3_id,
            min_price,
            max_price,
            search,
            sort_by = 'newest',
            language = Language.fa
        } = options;

        const cacheKey = `public_products:${JSON.stringify(options)}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any;
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        const where: Prisma.ProductWhereInput = {
            status: ProductStatus.APPROVED,
            confirmed: true
        };

        // فیلترهای جغرافیایی
        if (location_level_1_id) where.location_level_1_id = location_level_1_id;
        if (location_level_2_id) where.location_level_2_id = location_level_2_id;
        if (location_level_3_id) where.location_level_3_id = location_level_3_id;

        // فیلترهای دسته‌بندی
        if (category_id) where.category_id = category_id;
        if (sub_category_id) where.sub_category_id = sub_category_id;

        // فیلتر قیمت - استفاده از base_min_price به جای calculated_min_price
        if (min_price !== undefined || max_price !== undefined) {
            where.base_min_price = {};
            if (min_price !== undefined) (where.base_min_price as any).gte = min_price;
            if (max_price !== undefined) (where.base_min_price as any).lte = max_price;
        }

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
                },
                {
                    contents: {
                        some: {
                            language,
                            brand_name: { contains: search, mode: 'insensitive' }
                        }
                    }
                }
            ];
        }

        // فقط محصولات با تصویر
        where.files = {
            some: {
                file_usage: FileUsage.PRODUCT_IMAGE,
                status: "2"
            }
        };

        const orderBy = this.buildPublicOrderBy(sort_by);
        const skip = (page - 1) * limit;

        try {
            const [products, total] = await Promise.all([
                this.prisma.product.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getPublicProductInclude(language),
                    orderBy,
                }),
                this.prisma.product.count({ where }),
            ]);

            const enrichedProducts = await Promise.all(
                products.map(product => this.enrichPublicProduct(product, language))
            );

            const result = {
                products: enrichedProducts,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };

            try {
                await this.cacheManager.set(cacheKey, result, 2 * 60 * 1000); // 2 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return result;
        } catch (error) {
            console.error('Error in getActiveProducts:', error);
            throw error;
        }
    }

    // ==================== دریافت محصولات ویژه و بوست شده ====================
    async getFeaturedProducts(limit: number = 8, language: Language = Language.fa): Promise<any[]> {
        const cacheKey = `featured_products:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any[];
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        const where: Prisma.ProductWhereInput = {
            status: ProductStatus.APPROVED,
            confirmed: true,
            boost_purchased: true,
            boost_expires_at: {
                gt: new Date()
            },
            files: {
                some: {
                    file_usage: FileUsage.PRODUCT_IMAGE,
                    status: "2"
                }
            }
        };

        try {
            const products = await this.prisma.product.findMany({
                where,
                take: limit,
                include: this.getPublicProductInclude(language),
                orderBy: [
                    { total_views: 'desc' },
                    { created_at: 'desc' }
                ],
            });

            const enrichedProducts = await Promise.all(
                products.map(product => this.enrichPublicProduct(product, language))
            );

            try {
                await this.cacheManager.set(cacheKey, enrichedProducts, 5 * 60 * 1000); // 5 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return enrichedProducts;
        } catch (error) {
            console.error('Error in getFeaturedProducts:', error);
            throw error;
        }
    }

    // ==================== دریافت محصولات پرطرفدار ====================
    async getPopularProducts(limit: number = 10, days: number = 7, language: Language = Language.fa): Promise<any[]> {
        const cacheKey = `popular_products:${limit}:${days}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any[];
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        try {
            // یافتن محصولات پرتعامل در بازه زمانی مشخص
            const popularProductIds = await this.prisma.interaction.groupBy({
                by: ['product_id'],
                where: {
                    created_at: { gte: sinceDate },
                    type: { in: [InteractionType.VIEW, InteractionType.LIKE, InteractionType.SAVE] }
                },
                _count: true,
                orderBy: { _count: { product_id: 'desc' } },
                take: limit * 2 // بیشتر می‌گیریم چون ممکن است بعضی محصولات حذف شده باشند
            });

            const productIds = popularProductIds.map(item => item.product_id);

            if (productIds.length === 0) {
                return [];
            }

            const products = await this.prisma.product.findMany({
                where: {
                    id: { in: productIds },
                    status: ProductStatus.APPROVED,
                    confirmed: true,
                    files: {
                        some: {
                            file_usage: FileUsage.PRODUCT_IMAGE,
                            status: "2"
                        }
                    }
                },
                include: this.getPublicProductInclude(language)
            });

            // مرتب‌سازی بر اساس تعداد تعاملات
            products.sort((a, b) => {
                const aCount = popularProductIds.find(p => p.product_id === a.id)?._count || 0;
                const bCount = popularProductIds.find(p => p.product_id === b.id)?._count || 0;
                return bCount - aCount;
            });

            const result = await Promise.all(
                products.slice(0, limit).map(product =>
                    this.enrichPublicProduct(product, language)
                )
            );

            try {
                await this.cacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return result;
        } catch (error) {
            console.error('Error in getPopularProducts:', error);
            throw error;
        }
    }

    // ==================== دریافت محصولات جدید ====================
    async getNewProducts(limit: number = 12, language: Language = Language.fa): Promise<any[]> {
        const cacheKey = `new_products:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any[];
            }
        } catch (error) {
            console.warn('Cache get error:', error);
        }

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

        try {
            const products = await this.prisma.product.findMany({
                where,
                take: limit,
                include: this.getPublicProductInclude(language),
                orderBy: { created_at: 'desc' },
            });

            const enrichedProducts = await Promise.all(
                products.map(product => this.enrichPublicProduct(product, language))
            );

            try {
                await this.cacheManager.set(cacheKey, enrichedProducts, 15 * 60 * 1000); // 15 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return enrichedProducts;
        } catch (error) {
            console.error('Error in getNewProducts:', error);
            throw error;
        }
    }

    // ==================== دریافت محصولات مشابه ====================
    async getSimilarProducts(productId: string, limit: number = 6, language: Language = Language.fa): Promise<any[]> {
        const cacheKey = `similar_products:${productId}:${limit}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as any[];
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
                    location_level_2_id: true,
                    location_level_3_id: true,
                    base_min_price: true, // استفاده از base_min_price به جای calculated_min_price
                    contents: {
                        where: { language },
                        select: { brand_name: true, category_name: true }
                    }
                }
            });

            if (!product) {
                throw new I18nNotFoundException('PRODUCT_NOT_FOUND', language, { id: productId });
            }

            const brandName = product.contents?.[0]?.brand_name;
            const basePrice = product.base_min_price || 0; // استفاده از base_min_price
            const priceRange = basePrice > 0 ? {
                min: basePrice * 0.7,
                max: basePrice * 1.3
            } : null;

            const where: Prisma.ProductWhereInput = {
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

            // شرایط مشابهت
            const similarityConditions = [];

            if (product.category_id) {
                similarityConditions.push({ category_id: product.category_id });
            }

            if (product.sub_category_id) {
                similarityConditions.push({ sub_category_id: product.sub_category_id });
            }

            if (brandName) {
                similarityConditions.push({
                    contents: {
                        some: {
                            language,
                            brand_name: { contains: brandName, mode: 'insensitive' }
                        }
                    }
                });
            }

            if (priceRange && basePrice > 0) {
                similarityConditions.push({
                    base_min_price: { // استفاده از base_min_price
                        gte: priceRange.min,
                        lte: priceRange.max
                    }
                });
            }

            if (similarityConditions.length > 0) {
                where.OR = similarityConditions;
            }

            const products = await this.prisma.product.findMany({
                where,
                take: limit,
                include: this.getPublicProductInclude(language),
                orderBy: [
                    { boost_purchased: 'desc' },
                    { total_views: 'desc' },
                    { created_at: 'desc' }
                ],
            });

            const enrichedProducts = await Promise.all(
                products.map(p => this.enrichPublicProduct(p, language))
            );

            try {
                await this.cacheManager.set(cacheKey, enrichedProducts, 30 * 60 * 1000); // 30 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return enrichedProducts;
        } catch (error) {
            console.error('Error in getSimilarProducts:', error);
            throw error;
        }
    }

    // ==================== دریافت جزئیات کامل محصول برای نمایش عمومی ====================
    async getProductDetail(id: string, language: Language = Language.fa, trackView: boolean = true): Promise<any> {
        const cacheKey = `product_detail:${id}:${language}`;

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
                where: {
                    id,
                    status: ProductStatus.APPROVED,
                    confirmed: true
                },
                include: this.getProductDetailInclude(language)
            });

            if (!product) {
                throw new I18nNotFoundException('PRODUCT_NOT_FOUND', language, { id });
            }

            const enrichedProduct = await this.enrichProductDetail(product, language);

            // ردیابی بازدید (غیرهمزمان)
            if (trackView) {
                this.trackProductView(id).catch(error =>
                    console.error('Error tracking product view:', error)
                );
            }

            try {
                await this.cacheManager.set(cacheKey, enrichedProduct, 10 * 60 * 1000); // 10 minutes cache
            } catch (error) {
                console.warn('Cache set error:', error);
            }

            return enrichedProduct;
        } catch (error) {
            console.error('Error in getProductDetail:', error);
            throw error;
        }
    }

    // ==================== متدهای کمکی ====================

    private getPublicProductInclude(language: Language) {
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
                    category_name: true
                }
            },
            _count: {
                select: {
                    reviews: { where: { confirmed: true } },
                    interactions: {
                        where: { type: { in: [InteractionType.LIKE, InteractionType.SAVE] } }
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
                    has_discount: true,
                    custom_adjustment_percent: true
                }
            }
        };
    }





    private async enrichProductDetail(product: any, language: Language): Promise<any> {
        const baseProduct = await this.enrichPublicProduct(product, language);
        const content = product.contents?.[0] || {};
        const userContent = product.user?.contents?.[0] || {};

        return {
            ...baseProduct,

            // اطلاعات کامل
            address: content.address,
            tags: content.tags,
            sub_category_name: content.sub_category_name,
            super_category_name: content.super_category_name,
            city_name: content.city_name,
            technical_specs: content.technical_specs,
            features: content.features,

            // اطلاعات فروشنده
            seller: product.user ? {
                id: product.user.id,
                user_name: product.user.user_name,
                first_name: userContent.first_name,
                last_name: userContent.last_name,
                full_name: `${userContent.first_name || ''} ${userContent.last_name || ''}`.trim(),
                is_verified: product.user.is_verified
            } : null,

            // گالری تصاویر
            gallery: product.files.filter((file: any) =>
                file.file_usage === FileUsage.PRODUCT_GALLERY
            ),

            // ویدئوها
            videos: product.files.filter((file: any) =>
                file.file_usage === FileUsage.PRODUCT_VIDEO
            ),

            // استراتژی‌های قیمت‌گذاری
            pricing_strategies: product.pricing_strategies,

            // بازخوردها
            recent_reviews: product.reviews,

            // آمار کامل
            detailed_stats: {
                ...baseProduct.stats,
                comments: product._count?.comments || 0,
                average_rating: this.calculateAverageRating(product.reviews)
            }
        };
    }

    private buildPublicOrderBy(sortBy: string): any {
        const orderByMap: { [key: string]: any } = {
            'newest': { created_at: 'desc' },
            'oldest': { created_at: 'asc' },
            'price_low': { base_min_price: 'asc' }, // استفاده از base_min_price
            'price_high': { base_min_price: 'desc' }, // استفاده از base_min_price
            'popular': { total_views: 'desc' },
            'most_liked': { total_likes: 'desc' },
            'most_saved': { total_saves: 'desc' },
            'stock_high': { stock: 'desc' },
            'featured': [
                { boost_purchased: 'desc' },
                { total_views: 'desc' }
            ],
            'relevance': [
                { boost_purchased: 'desc' },
                { total_views: 'desc' },
                { created_at: 'desc' }
            ]
        };

        return orderByMap[sortBy] || orderByMap['newest'];
    }

    private calculateAverageRating(reviews: any[]): number {
        if (!reviews || reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, review) => acc + review.rating_score, 0);
        return Math.round((sum / reviews.length) * 10) / 10;
    }

    private async trackProductView(productId: string): Promise<void> {
        try {
            await this.prisma.product.update({
                where: { id: productId },
                data: {
                    total_views: { increment: 1 }
                }
            });

            // پاکسازی کش مربوط به این محصول
            await this.clearProductCache(productId);
        } catch (error) {
            console.error('Error tracking product view:', error);
        }
    }

    // ==================== متدهای اضافی برای جستجوی پیشرفته ====================

    async searchProductsAdvanced(filters: {
        query?: string;
        category_id?: string;
        sub_category_id?: string;
        location_level_1_id?: string;
        location_level_2_id?: string;
        location_level_3_id?: string;
        min_price?: number;
        max_price?: number;
        min_stock?: number;
        unit?: string;
        has_video?: boolean;
        brand_name?: string;
        sort_by?: string;
        page?: number;
        limit?: number;
        language?: Language;
    }): Promise<{ products: any[]; total: number; page: number; totalPages: number; filters: any }> {
        // پیاده‌سازی مشابه getActiveProducts با فیلترهای بیشتر
        // برای جلوگیری از طولانی شدن کد، این بخش را می‌توانید از کد اصلی کپی کنید
        throw new Error('Method not implemented');
    }

    async getProductsByCategory(categoryId: string, options: {
        page?: number;
        limit?: number;
        sort_by?: string;
        language?: Language;
    } = {}): Promise<{ products: any[]; total: number; page: number; totalPages: number; category: any }> {
        // پیاده‌سازی مشابه getActiveProducts با فیلتر دسته‌بندی
        throw new Error('Method not implemented');
    }
}