// src/services/product/BaseProductService.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import {
    PrismaClient,
    Product,
    ProductStatus,
    SellUnit,
    Language,
    PricingConditionType,
    PricingConditionCategory,
    FileUsage,
    ProductContent,
    Prisma,
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import {PrismaService} from "../../prisma/prisma.service";

@Injectable()
export class ProductBaseService {
    constructor(
        protected prisma: PrismaService,
        @Inject(CACHE_MANAGER) protected cacheManager: Cache
    ) {}

    private readonly CACHE_TTL = 5 * 60 * 1000;

    // ==================== ایجاد محصول جدید ====================
    // ==================== ایجاد محصول جدید ====================
    async createProduct(data: {
        stock?: number;
        min_sale_amount: number;
        unit: SellUnit;
        account_id: string;
        user_id: string;
        category_id?: string;
        sub_category_id?: string;
        catalog_id?: string;
        location_level_1_id?: string;
        location_level_2_id?: string;
        location_level_3_id?: string;
        location_level_4_id?: string;
        base_min_price?: number;
        base_max_price?: number;
        is_brands_representative?: boolean;
        status?: ProductStatus;
        is_based_on_catalog?: boolean;
        contents?: {
            language: Language;
            name: string;
            description?: string;
            address?: string;
            tags?: string[];
            category_name?: string;
            sub_category_name?: string;
            super_category_name?: string;
            brand_name?: string;
            city_name?: string;
            technical_specs?: any;
            features?: string[];
            auto_translated?: boolean;
        }[];
        pricing_strategies?: {
            condition_category?: PricingConditionCategory;
            condition_type?: PricingConditionType;
            price_unit: SellUnit;
            conversion_rate?: number;
            base_price_amount?: number;
            custom_adjustment_percent?: number;
            condition_config?: any;
            is_primary?: boolean;
            is_active?: boolean;
        }[];
    }): Promise<Product> {
        // اعتبارسنجی اکانت
        const account = await this.prisma.account.findUnique({
            where: {
                id: data.account_id,
                is_active: true
            }
        });

        if (!account) {
            throw new NotFoundException('اکانت مربوطه یافت نشد یا غیرفعال است');
        }

        // اعتبارسنجی دسترسی کاربر به اکانت
        const accountUser = await this.prisma.accountUser.findUnique({
            where: {
                user_id_account_id: {
                    user_id: data.user_id,
                    account_id: data.account_id,
                }
            }
        });

        if (!accountUser) {
            throw new ForbiddenException('دسترسی به اکانت مورد نظر ندارید');
        }

        // اعتبارسنجی دسته‌بندی
        if (data.category_id) {
            const category = await this.prisma.category.findUnique({
                where: { id: data.category_id }
            });
            if (!category) {
                throw new NotFoundException('دسته‌بندی یافت نشد');
            }
        }

        // اعتبارسنجی کاتالوگ
        if (data.catalog_id) {
            const catalog = await this.prisma.catalog.findUnique({
                where: { id: data.catalog_id }
            });
            if (!catalog) {
                throw new NotFoundException('کاتالوگ یافت نشد');
            }
        }

        return this.prisma.$transaction(async (tx) => {
            // محاسبه قیمت پایه از استراتژی‌های قیمت‌گذاری
            const basePrice = await this.calculateBasePriceFromStrategies(data.pricing_strategies);

            // ایجاد محصول اصلی - فقط با فیلدهای موجود در مدل
            const productData: any = {
                stock: data.stock || 0,
                min_sale_amount: data.min_sale_amount,
                unit: data.unit,
                status: data.status || ProductStatus.PENDING,
                account_id: data.account_id,
                user_id: data.user_id,
                category_id: data.category_id,
                sub_category_id: data.sub_category_id,
                catalog_id: data.catalog_id,
                location_level_1_id: data.location_level_1_id,
                location_level_2_id: data.location_level_2_id,
                location_level_3_id: data.location_level_3_id,
                location_level_4_id: data.location_level_4_id,
                base_min_price: basePrice,
                base_max_price: basePrice,
                calculated_min_price: basePrice,
                calculated_max_price: basePrice,
                has_any_discount: false,
                is_brands_representative: data.is_brands_representative || false,
                is_based_on_catalog: data.is_based_on_catalog || false,
                total_views: 0,
                total_likes: 0,
                total_saves: 0,
                has_video: false,
                boost_purchased: false,
                boost_power: 0,
                boost_is_elevated: false,
            };

            // حذف فیلدهای undefined
            Object.keys(productData).forEach(key => {
                if (productData[key] === undefined) {
                    delete productData[key];
                }
            });

            const product = await tx.product.create({
                data: productData
            });

            // ایجاد محتوای چندزبانه
            if (data.contents && data.contents.length > 0) {
                await tx.productContent.createMany({
                    data: data.contents.map(content => ({
                        product_id: product.id,
                        language: content.language,
                        name: content.name,
                        description: content.description,
                        address: content.address,
                        tags: content.tags || [],
                        category_name: content.category_name,
                        sub_category_name: content.sub_category_name,
                        super_category_name: content.super_category_name,
                        brand_name: content.brand_name,
                        city_name: content.city_name,
                        technical_specs: content.technical_specs,
                        features: content.features || [],
                        auto_translated: content.auto_translated || true
                    }))
                });
            } else {
                // ایجاد محتوای پیش‌فرض
                await tx.productContent.create({
                    data: {
                        product_id: product.id,
                        language: Language.fa,
                        name: `محصول ${product.id}`,
                        description: 'توضیحات محصول',
                        auto_translated: false
                    }
                });
            }

            // ایجاد استراتژی‌های قیمت‌گذاری
            if (data.pricing_strategies && data.pricing_strategies.length > 0) {
                for (const priceData of data.pricing_strategies) {
                    await tx.productPrice.create({
                        data: {
                            product_id: product.id,
                            condition_category: priceData.condition_category,
                            condition_type: priceData.condition_type,
                            price_unit: priceData.price_unit,
                            conversion_rate: priceData.conversion_rate || 1.0,
                            base_price_amount: priceData.base_price_amount || basePrice,
                            custom_adjustment_percent: priceData.custom_adjustment_percent,
                            condition_config: priceData.condition_config,
                            is_primary: priceData.is_primary || false,
                            is_active: priceData.is_active !== false,
                            final_price_amount: this.calculateFinalPrice(
                                priceData.base_price_amount || basePrice,
                                priceData.custom_adjustment_percent
                            ),
                            has_discount: !!(priceData.custom_adjustment_percent && priceData.custom_adjustment_percent < 0)
                        }
                    });
                }
            } else {
                // ایجاد قیمت پیش‌فرض
                await tx.productPrice.create({
                    data: {
                        product_id: product.id,
                        price_unit: data.unit,
                        base_price_amount: basePrice,
                        conversion_rate: 1.0,
                        is_primary: true,
                        is_active: true,
                        final_price_amount: basePrice,
                        has_discount: false
                    }
                });
            }

            // محاسبه خلاصه قیمت‌ها
            await this.updateProductPriceSummary(product.id, tx);

            await this.clearProductCaches(data.user_id, data.account_id);

            return product;
        });
    }

    // ==================== دریافت محصول بر اساس ID ====================
    // ==================== دریافت محصول بر اساس ID ====================
    async getProductById(id: string, language: Language = Language.fa): Promise<any> {
        const cacheKey = `product:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const product = await this.prisma.product.findUnique({
            where: { id },
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
                        is_verified: true,
                        contents: {
                            where: { language },
                            select: { first_name: true, last_name: true }
                        }
                    }
                },
                files: {
                    where: {
                        file_usage: {
                            in: [FileUsage.PRODUCT_IMAGE, FileUsage.PRODUCT_GALLERY, FileUsage.PRODUCT_VIDEO, FileUsage.PRODUCT_CERT]
                        }
                    },
                    select: {
                        id: true,
                        file_usage: true,
                        file_path: true,
                        thumbnail_path: true,
                        description: true,
                        created_at: true,
                    },
                    orderBy: {
                        created_at: 'asc'
                    }
                },
                contents: {
                    where: { language },
                    select: {
                        name: true,
                        description: true,
                        address: true,
                        tags: true,
                        category_name: true,
                        sub_category_name: true,
                        super_category_name: true,
                        brand_name: true,
                        city_name: true,
                        technical_specs: true,
                        features: true
                    }
                },
                pricing_strategies: {
                    where: { is_active: true },
                    select: {
                        id: true,
                        condition_category: true,
                        condition_type: true,
                        price_unit: true,
                        base_price_amount: true,
                        final_price_amount: true,
                        custom_adjustment_percent: true,
                        is_primary: true,
                        has_discount: true
                    }
                },
                _count: {
                    select: {
                        reviews: true,
                        interactions: true,
                        comments: true,
                    }
                }
            }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        const enrichedProduct = this.enrichProductWithContent(product, language);

        await this.cacheManager.set(cacheKey, enrichedProduct, this.CACHE_TTL);
        return enrichedProduct;
    }

    // ==================== به‌روزرسانی محصول ====================
    async updateProduct(id: string, data: {
        stock?: number;
        min_sale_amount?: number;
        unit?: SellUnit;
        category_id?: string;
        sub_category_id?: string;
        catalog_id?: string;
        location_level_1_id?: string;
        location_level_2_id?: string;
        location_level_3_id?: string;
        location_level_4_id?: string;
        base_min_price?: number;
        base_max_price?: number;
        is_brands_representative?: boolean;
        status?: ProductStatus;
        contents?: {
            language: Language;
            name?: string;
            description?: string;
            address?: string;
            tags?: string[];
            category_name?: string;
            sub_category_name?: string;
            super_category_name?: string;
            brand_name?: string;
            city_name?: string;
            technical_specs?: any;
            features?: string[];
            auto_translated?: boolean;
        }[];
        pricing_strategies?: {
            condition_category?: PricingConditionCategory;
            condition_type?: PricingConditionType;
            price_unit: SellUnit;
            conversion_rate?: number;
            base_price_amount?: number;
            custom_adjustment_percent?: number;
            condition_config?: any;
            is_primary?: boolean;
            is_active?: boolean;
        }[];
    }, userId: string): Promise<Product> {
        const product = await this.prisma.product.findUnique({
            where: { id },
            select: {
                id: true,
                user_id: true,
                account_id: true,
                status: true,
                base_min_price: true
                // ❌ calculated_min_price حذف شد
            }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        if (product.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این محصول را ندارید');
        }

        let status = product.status;

        // بررسی تغییر قیمت
        const hasPriceChanged =
            (data.base_min_price !== undefined && data.base_min_price !== product.base_min_price);

        if (hasPriceChanged) {
            status = ProductStatus.EDIT_PENDING;
        }

        return this.prisma.$transaction(async (tx) => {
            // بروزرسانی محصول اصلی
            const updateData: any = {
                status
                // ❌ last_price_update حذف شد
            };

            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && !['contents', 'pricing_strategies'].includes(key)) {
                    updateData[key] = data[key];
                }
            });

            const updatedProduct = await tx.product.update({
                where: { id },
                data: updateData
            });

            // بروزرسانی محتوای چندزبانه
            if (data.contents && data.contents.length > 0) {
                for (const content of data.contents) {
                    await tx.productContent.upsert({
                        where: {
                            product_id_language: {
                                product_id: id,
                                language: content.language
                            }
                        },
                        update: {
                            ...(content.name && { name: content.name }),
                            ...(content.description && { description: content.description }),
                            ...(content.address && { address: content.address }),
                            ...(content.tags && { tags: content.tags }),
                            ...(content.category_name && { category_name: content.category_name }),
                            ...(content.sub_category_name && { sub_category_name: content.sub_category_name }),
                            ...(content.super_category_name && { super_category_name: content.super_category_name }),
                            ...(content.brand_name && { brand_name: content.brand_name }),
                            ...(content.city_name && { city_name: content.city_name }),
                            ...(content.technical_specs && { technical_specs: content.technical_specs }),
                            ...(content.features && { features: content.features }),
                            ...(content.auto_translated !== undefined && { auto_translated: content.auto_translated })
                        },
                        create: {
                            product_id: id,
                            language: content.language,
                            name: content.name || `محصول ${id}`,
                            description: content.description,
                            address: content.address,
                            tags: content.tags || [],
                            category_name: content.category_name,
                            sub_category_name: content.sub_category_name,
                            super_category_name: content.super_category_name,
                            brand_name: content.brand_name,
                            city_name: content.city_name,
                            technical_specs: content.technical_specs,
                            features: content.features || [],
                            auto_translated: content.auto_translated || true
                        }
                    });
                }
            }

            // بروزرسانی استراتژی‌های قیمت‌گذاری
            if (data.pricing_strategies) {
                // حذف قیمت‌های قدیمی و ایجاد جدید
                await tx.productPrice.deleteMany({
                    where: { product_id: id }
                });

                for (const priceData of data.pricing_strategies) {
                    await tx.productPrice.create({
                        data: {
                            product_id: id,
                            condition_category: priceData.condition_category,
                            condition_type: priceData.condition_type,
                            price_unit: priceData.price_unit,
                            conversion_rate: priceData.conversion_rate || 1.0,
                            base_price_amount: priceData.base_price_amount || updatedProduct.base_min_price,
                            custom_adjustment_percent: priceData.custom_adjustment_percent,
                            condition_config: priceData.condition_config,
                            is_primary: priceData.is_primary || false,
                            is_active: priceData.is_active !== false,
                            final_price_amount: this.calculateFinalPrice(
                                priceData.base_price_amount || updatedProduct.base_min_price,
                                priceData.custom_adjustment_percent
                            ),
                            has_discount: !!(priceData.custom_adjustment_percent && priceData.custom_adjustment_percent < 0)
                        }
                    });
                }

                // محاسبه خلاصه قیمت‌ها
                await this.updateProductPriceSummary(id, tx);
            }

            await this.clearProductCaches(userId, product.account_id);
            return updatedProduct;
        });
    }

    // ==================== حذف محصول ====================
    async deleteProduct(id: string, userId: string): Promise<boolean> {
        const product = await this.prisma.product.findUnique({
            where: { id }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        if (product.user_id !== userId) {
            throw new ForbiddenException('شما اجازه حذف این محصول را ندارید');
        }

        await this.prisma.$transaction(async (tx) => {
            // غیرفعال کردن محصول به جای حذف فیزیکی
            await tx.product.update({
                where: { id },
                data: {
                    status: ProductStatus.INACTIVE,
                    confirmed: false
                }
            });

            // غیرفعال کردن قیمت‌ها
            await tx.productPrice.updateMany({
                where: { product_id: id },
                data: { is_active: false }
            });
        });

        await this.clearProductCaches(userId, product.account_id);
        return true;
    }

    // ==================== جستجوی پیشرفته محصولات ====================
    async searchProducts(filters: {
        page?: number;
        limit?: number;
        search?: string;
        category_id?: string;
        sub_category_id?: string;
        min_price?: number;
        max_price?: number;
        sort_by?: string;
        status?: ProductStatus;
        account_id?: string;
        user_id?: string;
        language?: Language;
    }): Promise<{ products: any[]; total: number; page: number; totalPages: number }> {
        const {
            page = 1,
            limit = 10,
            search,
            category_id,
            sub_category_id,
            min_price,
            max_price,
            sort_by = 'newest',
            status = ProductStatus.APPROVED,
            account_id,
            user_id,
            language = Language.fa
        } = filters;

        const skip = (page - 1) * limit;

        const where: Prisma.ProductWhereInput = {
            status: status,
            confirmed: status === ProductStatus.APPROVED
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

        // فیلترهای پایه
        if (category_id) where.category_id = category_id;
        if (sub_category_id) where.sub_category_id = sub_category_id;
        if (user_id) where.user_id = user_id;
        if (account_id) where.account_id = account_id;

        // فیلتر قیمت
        // فیلتر قیمت - استفاده از فیلدهای موجود
        if (min_price !== undefined || max_price !== undefined) {
            where.base_min_price = {};
            if (min_price !== undefined) where.base_min_price.gte = min_price;
            if (max_price !== undefined) where.base_min_price.lte = max_price;
        }// فیلتر قیمت - استفاده از فیلدهای موجود
        if (min_price !== undefined || max_price !== undefined) {
            where.base_min_price = {};
            if (min_price !== undefined) where.base_min_price.gte = min_price;
            if (max_price !== undefined) where.base_min_price.lte = max_price;
        }

        const orderBy = this.buildSearchOrderBy(sort_by);

        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                include: this.getProductListInclude(language),
                orderBy,
            }),
            this.prisma.product.count({ where }),
        ]);

        const enrichedProducts = products.map(product =>
            this.enrichProductWithContent(product, language)
        );

        return {
            products: enrichedProducts,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    // ==================== مدیریت موجودی ====================
    async updateStock(productId: string, newStock: number, userId: string): Promise<Product> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        if (product.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این محصول را ندارید');
        }

        const updatedProduct = await this.prisma.product.update({
            where: { id: productId },
            data: {
                stock: newStock,
                ...(newStock === 0 && { status: ProductStatus.OUT_OF_STOCK }),
                ...(newStock > 0 && product.status === ProductStatus.OUT_OF_STOCK && { status: ProductStatus.APPROVED })
            }
        });

        await this.clearProductCaches(userId, product.account_id);
        return updatedProduct;
    }

    // ==================== مدیریت قیمت‌ها ====================
    async updateProductPrices(productId: string, priceData: {
        pricing_strategies: {
            condition_category?: PricingConditionCategory;
            condition_type?: PricingConditionType;
            price_unit: SellUnit;
            conversion_rate?: number;
            base_price_amount?: number;
            custom_adjustment_percent?: number;
            condition_config?: any;
            is_primary?: boolean;
            is_active?: boolean;
        }[];
    }, userId: string): Promise<Product> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        if (product.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این محصول را ندارید');
        }

        return this.prisma.$transaction(async (tx) => {
            // حذف قیمت‌های قدیمی
            await tx.productPrice.deleteMany({
                where: { product_id: productId }
            });

            // ایجاد قیمت‌های جدید
            for (const price of priceData.pricing_strategies) {
                await tx.productPrice.create({
                    data: {
                        product_id: productId,
                        condition_category: price.condition_category,
                        condition_type: price.condition_type,
                        price_unit: price.price_unit,
                        conversion_rate: price.conversion_rate || 1.0,
                        base_price_amount: price.base_price_amount || product.base_min_price,
                        custom_adjustment_percent: price.custom_adjustment_percent,
                        condition_config: price.condition_config,
                        is_primary: price.is_primary || false,
                        is_active: price.is_active !== false,
                        final_price_amount: this.calculateFinalPrice(
                            price.base_price_amount || product.base_min_price,
                            price.custom_adjustment_percent
                        ),
                        has_discount: !!(price.custom_adjustment_percent && price.custom_adjustment_percent < 0)
                    }
                });
            }

            // محاسبه خلاصه قیمت‌ها
            await this.updateProductPriceSummary(productId, tx);

            const updatedProduct = await tx.product.findUnique({
                where: { id: productId }
            });

            await this.clearProductCaches(userId, product.account_id);
            return updatedProduct!;
        });
    }

    // ==================== مدیریت محتوای چندزبانه ====================
    async updateProductContent(productId: string, contents: {
        language: Language;
        name?: string;
        description?: string;
        address?: string;
        tags?: string[];
        category_name?: string;
        sub_category_name?: string;
        super_category_name?: string;
        brand_name?: string;
        city_name?: string;
        technical_specs?: any;
        features?: string[];
        auto_translated?: boolean;
    }[], userId: string): Promise<void> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        if (product.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این محصول را ندارید');
        }

        await this.prisma.$transaction(async (tx) => {
            for (const content of contents) {
                await tx.productContent.upsert({
                    where: {
                        product_id_language: {
                            product_id: productId,
                            language: content.language
                        }
                    },
                    update: {
                        ...(content.name && { name: content.name }),
                        ...(content.description && { description: content.description }),
                        ...(content.address && { address: content.address }),
                        ...(content.tags && { tags: content.tags }),
                        ...(content.category_name && { category_name: content.category_name }),
                        ...(content.sub_category_name && { sub_category_name: content.sub_category_name }),
                        ...(content.super_category_name && { super_category_name: content.super_category_name }),
                        ...(content.brand_name && { brand_name: content.brand_name }),
                        ...(content.city_name && { city_name: content.city_name }),
                        ...(content.technical_specs && { technical_specs: content.technical_specs }),
                        ...(content.features && { features: content.features }),
                        ...(content.auto_translated !== undefined && { auto_translated: content.auto_translated })
                    },
                    create: {
                        product_id: productId,
                        language: content.language,
                        name: content.name || `محصول ${productId}`,
                        description: content.description,
                        address: content.address,
                        tags: content.tags || [],
                        category_name: content.category_name,
                        sub_category_name: content.sub_category_name,
                        super_category_name: content.super_category_name,
                        brand_name: content.brand_name,
                        city_name: content.city_name,
                        technical_specs: content.technical_specs,
                        features: content.features || [],
                        auto_translated: content.auto_translated || true
                    }
                });
            }
        });

        await this.clearProductCaches(userId, product.account_id);
    }

    // ==================== محصولات مرتبط ====================
    // ==================== محصولات مرتبط ====================
    async getRelatedProducts(productId: string, limit: number = 8, language: Language = Language.fa): Promise<any[]> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: {
                category_id: true,
                sub_category_id: true,
                contents: {
                    where: { language },
                    select: { brand_name: true }
                }
            }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        // حل مشکل دسترسی به محتوای چندزبانه
        let brandName: string | null = null;
        if (product.contents && product.contents.length > 0 && product.contents[0]) {
            brandName = product.contents[0].brand_name;
        }

        // ساخت شرط OR برای محصولات مرتبط
        const orConditions: any[] = [];

        // شرط دسته‌بندی اصلی
        if (product.category_id) {
            orConditions.push({ category_id: product.category_id });
        }

        // شرط زیردسته‌بندی
        if (product.sub_category_id) {
            orConditions.push({ sub_category_id: product.sub_category_id });
        }

        // شرط برند (اگر وجود داشته باشد)
        if (brandName && brandName.trim() !== '') {
            orConditions.push({
                contents: {
                    some: {
                        language: language,
                        brand_name: {
                            contains: brandName,
                            mode: 'insensitive' as Prisma.QueryMode
                        }
                    }
                }
            });
        }

        // اگر هیچ شرطی وجود نداشت، برگردان
        if (orConditions.length === 0) {
            return [];
        }

        const relatedProducts = await this.prisma.product.findMany({
            where: {
                id: { not: productId },
                OR: orConditions,
                status: ProductStatus.APPROVED
            },
            take: limit,
            include: this.getProductListInclude(language),
            orderBy: [
                { boost_purchased: 'desc' },
                { total_views: 'desc' },
                { created_at: 'desc' }
            ]
        });

        return relatedProducts.map(p => this.enrichProductWithContent(p, language));
    }

    // ==================== آمار و آنالیتیکس ====================
    async getProductStats(productId: string): Promise<any> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                total_views: true,
                total_likes: true,
                total_saves: true,
                stock: true,
                status: true,
                created_at: true
            }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد');
        }

        const [reviews, interactions, files] = await Promise.all([
            this.prisma.review.count({
                where: {
                    product_id: productId,
                    confirmed: true
                }
            }),
            this.prisma.interaction.count({
                where: { product_id: productId }
            }),
            this.prisma.file.count({
                where: { product_id: productId }
            })
        ]);

        const engagementScore = this.calculateEngagementScore(
            product.total_views,
            product.total_likes,
            product.total_saves
        );

        return {
            basic_stats: {
                views: product.total_views,
                likes: product.total_likes,
                saves: product.total_saves,
                reviews,
                interactions,
                files
            },
            engagement: {
                score: engagementScore,
                level: this.getEngagementLevel(engagementScore)
            },
            inventory: {
                stock: product.stock,
                status: product.status
            },
            timeline: {
                created_at: product.created_at,
                days_since_creation: Math.floor((new Date().getTime() - product.created_at.getTime()) / (1000 * 60 * 60 * 24))
            }
        };
    }

    // ==================== متدهای کمکی ====================

    getProductDetailInclude(language: Language): Prisma.ProductInclude {
        const productInclude = Prisma.validator<Prisma.ProductInclude>()({
            account: {
                select: {
                    id: true,
                    activity_type: true,
                    profile_photo: true,
                    confirmed: true,
                    total_views: true,
                    total_likes: true,
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
                    is_verified: true,
                    contents: {
                        where: { language },
                        select: { first_name: true, last_name: true }
                    }
                }
            },
            files: {
                where: {
                    file_usage: {
                        in: [FileUsage.PRODUCT_IMAGE, FileUsage.PRODUCT_GALLERY, FileUsage.PRODUCT_VIDEO]
                    }
                },
                select: {
                    id: true,
                    file_usage: true,
                    file_path: true,
                    thumbnail_path: true,
                },
                orderBy: {
                    created_at: 'asc'
                }
            },
            contents: {
                where: { language },
                select: {
                    name: true,
                    description: true,
                    address: true,
                    tags: true,
                    category_name: true,
                    sub_category_name: true,
                    super_category_name: true,
                    brand_name: true,
                    city_name: true,
                    technical_specs: true,
                    features: true
                }
            },
            pricing_strategies: {
                where: { is_active: true },
                select: {
                    id: true,
                    condition_category: true,
                    condition_type: true,
                    price_unit: true,
                    base_price_amount: true,
                    final_price_amount: true,
                    custom_adjustment_percent: true,
                    is_primary: true,
                    has_discount: true
                }
            },
            reviews: {
                where: { confirmed: true },
                take: 5,
                orderBy: {
                    created_at: 'desc'
                },
                select: {
                    id: true,
                    rating_score: true,
                    created_at: true,
                    user: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    contents: {
                        where: { language },
                        select: { comment: true }
                    }
                }
            },
            _count: {
                select: {
                    reviews: { where: { confirmed: true } },
                    interactions: true,
                    comments: { where: { confirmed: true } },
                }
            }
        });

        return productInclude;
    }

    private getProductListInclude(language: Language) {
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
            contents: {
                where: { language },
                select: {
                    name: true,
                    description: true,
                    brand_name: true
                }
            },
            _count: {
                select: {
                    files: {
                        where: { file_usage: FileUsage.PRODUCT_IMAGE }
                    },
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

    private enrichProductWithContent(product: any, language: Language) {
        if (!product) return product;

        const content = product.contents?.[0] || {};
        const accountContent = product.account?.contents?.[0] || {};

        return {
            ...product,
            // بازنویسی فیلدهای قابل ترجمه
            name: content.name,
            description: content.description,
            address: content.address,
            tags: content.tags,
            category_name: content.category_name,
            sub_category_name: content.sub_category_name,
            super_category_name: content.super_category_name,
            brand_name: content.brand_name,
            city_name: content.city_name,
            technical_specs: content.technical_specs,
            features: content.features,

            // اطلاعات حساب با محتوای چندزبانه
            account: product.account ? {
                ...product.account,
                name: accountContent.name || product.account.name,
                description: accountContent.description || product.account.description
            } : null,

            // حذف محتوای خام
            contents: undefined
        };
    }

    private async calculateBasePriceFromStrategies(pricingStrategies?: any[]): Promise<number> {
        if (!pricingStrategies || pricingStrategies.length === 0) {
            return 0;
        }

        const primaryStrategy = pricingStrategies.find(s => s.is_primary);
        if (primaryStrategy && primaryStrategy.base_price_amount) {
            return primaryStrategy.base_price_amount;
        }

        const firstStrategy = pricingStrategies[0];
        return firstStrategy.base_price_amount || 0;
    }

     calculateFinalPrice(basePrice: number, adjustmentPercent?: number): number {
        if (!adjustmentPercent) {
            return basePrice;
        }
        return Math.round(basePrice * (1 + adjustmentPercent / 100));
    }

     async updateProductPriceSummary(productId: string, tx: any) {
        const prices = await tx.productPrice.findMany({
            where: {
                product_id: productId,
                is_active: true
            },
            select: {
                final_price_amount: true,
                has_discount: true,
                custom_adjustment_percent: true
            }
        });

        if (prices.length === 0) return;

        const finalPrices = prices.map(p => p.final_price_amount).filter(Boolean);
        const hasAnyDiscount = prices.some(p => p.has_discount);
        const discountPercents = prices.map(p => p.custom_adjustment_percent).filter(p => p && p < 0);
        const bestDiscountPercent = discountPercents.length > 0 ? Math.min(...discountPercents) : null;

        await tx.product.update({
            where: { id: productId },
            data: {
                base_min_price: finalPrices.length > 0 ? Math.min(...finalPrices) : 0,
                base_max_price: finalPrices.length > 0 ? Math.max(...finalPrices) : 0,
                calculated_min_price: finalPrices.length > 0 ? Math.min(...finalPrices) : 0,
                calculated_max_price: finalPrices.length > 0 ? Math.max(...finalPrices) : 0,
                has_any_discount: hasAnyDiscount,
                best_discount_percent: bestDiscountPercent
            }
        });
    }

    private buildSearchOrderBy(sortBy: string): any {
        const orderByMap = {
            'newest': { created_at: 'desc' },
            'oldest': { created_at: 'asc' },
            'price_low': { calculated_min_price: 'asc' },
            'price_high': { calculated_min_price: 'desc' },
            'popular': { total_views: 'desc' },
            'most_liked': { total_likes: 'desc' },
            'most_saved': { total_saves: 'desc' },
            'stock_high': { stock: 'desc' },
            'stock_low': { stock: 'asc' },
            'boost': [
                { boost_purchased: 'desc' },
                { boost_power: 'desc' },
                { total_views: 'desc' }
            ]
        };

        return orderByMap[sortBy] || orderByMap['newest'];
    }

    private calculateEngagementScore(views: number, likes: number, saves: number): number {
        return (likes * 3 + saves * 2 + views * 0.1) / (views || 1);
    }

    private getEngagementLevel(score: number): string {
        if (score > 50) return 'very_high';
        if (score > 20) return 'high';
        if (score > 10) return 'medium';
        return 'low';
    }

    private async clearProductCaches(userId: string, accountId: string): Promise<void> {
        try {
            const patterns = [
                `user_products:${userId}:*`,
                `account:${accountId}`,
                `user_accounts:${userId}`,
                'product_search:*',
                `product:${accountId}:*`
            ];

            for (const pattern of patterns) {
                await this.clearPatternKeys(pattern);
            }
        } catch (error) {
            console.error('Error clearing product caches:', error);
        }
    }



    private async getAllKeysByPattern(pattern: string): Promise<string[]> {
        // این یک پیاده‌سازی ساده است
        // در محیط production باید از قابلیت‌های خاص کش استفاده کنید
        return [];
    }

    // ==================== مدیریت کش پیشرفته ====================

    /**
     * پاکسازی کش بر اساس الگو
     */
    protected async clearPatternKeys(pattern: string): Promise<void> {
        try {
            const keys = await this.getKeysByPattern(pattern);
            if (keys.length > 0) {
                await Promise.all(keys.map(key => this.cacheManager.del(key)));
                console.log(`Cleared ${keys.length} cache keys for pattern: ${pattern}`);
            }
        } catch (error) {
            console.warn(`Could not clear pattern ${pattern}:`, error.message);
            // Fallback: پاکسازی کلی کش در صورت خطا
            await this.clearAllProductCaches();
        }
    }

    /**
     * دریافت کلیدهای کش بر اساس الگو
     */
    private async getKeysByPattern(pattern: string): Promise<string[]> {
        try {
            // این پیاده‌سازی بستگی به نوع کش منیجر شما داره
            // برای cache-manager با redis:
            if (typeof (this.cacheManager as any).store?.keys === 'function') {
                const allKeys = await (this.cacheManager as any).store.keys();
                return this.filterKeysByPattern(allKeys, pattern);
            }

            // برای کش‌های ساده‌تر، از لیست الگوهای از پیش تعریف شده استفاده می‌کنیم
            return this.getPredefinedKeysByPattern(pattern);
        } catch (error) {
            console.warn('Error getting keys by pattern:', error);
            return this.getPredefinedKeysByPattern(pattern);
        }
    }

    /**
     * فیلتر کلیدها بر اساس الگو
     */
    private filterKeysByPattern(keys: string[], pattern: string): string[] {
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);

        return keys.filter(key => regex.test(key));
    }

    /**
     * کلیدهای از پیش تعریف شده بر اساس الگو
     */
    private getPredefinedKeysByPattern(pattern: string): string[] {
        const predefinedPatterns: { [key: string]: string[] } = {
            // محصولات عمومی
            'product:*': [
                'product:',
                'product_detail:',
                'product_search:'
            ],
            'product_search:*': [
                'product_search:'
            ],
            'public_products:*': [
                'public_products:'
            ],
            'featured_products:*': [
                'featured_products:'
            ],
            'popular_products:*': [
                'popular_products:'
            ],
            'new_products:*': [
                'new_products:'
            ],
            'similar_products:*': [
                'similar_products:'
            ],

            // محصولات کاربر
            'user_products:*': [
                'user_products:'
            ],

            // محصولات شخصی‌سازی شده
            'personalized_recs:*': [
                'personalized_recs:'
            ],
            'similar_to_viewed:*': [
                'similar_to_viewed:'
            ],
            'complementary:*': [
                'complementary:'
            ],
            'foryou:*': [
                'foryou:'
            ],

            // مدیریتی
            'admin_products:*': [
                'admin_products:'
            ],
            'review_stats:*': [
                'review_stats:'
            ],
            'product_audit:*': [
                'product_audit:'
            ],

            // قیمت‌گذاری
            'price_strategies:*': [
                'price_strategies:'
            ],
            'price_calculation:*': [
                'price_calculation:'
            ],
            'competitive_analysis:*': [
                'competitive_analysis:'
            ],

            // دسته‌بندی‌ها
            'category_products:*': [
                'category_products:'
            ],
            'category_insights:*': [
                'category_insights:'
            ]
        };

        // پیدا کردن الگوی منطبق
        for (const [predefinedPattern, keys] of Object.entries(predefinedPatterns)) {
            const regex = new RegExp(`^${predefinedPattern.replace(/\*/g, '.*')}$`);
            if (regex.test(pattern)) {
                return keys.map(key => {
                    // جایگزینی پارامترها در الگو
                    const match = pattern.match(new RegExp(predefinedPattern.replace(/\*/g, '(.*)')));
                    if (match && match[1]) {
                        return key + match[1];
                    }
                    return key;
                });
            }
        }

        // اگر الگو پیدا نشد، آرایه خالی برگردان
        return [];
    }

    /**
     * پاکسازی تمام کش‌های مربوط به محصولات
     */
     async clearAllProductCaches(): Promise<void> {
        try {
            const patterns = [
                'product:*',
                'product_search:*',
                'public_products:*',
                'user_products:*',
                'personalized_recs:*',
                'admin_products:*',
                'price_strategies:*',
                'category_products:*'
            ];

            for (const pattern of patterns) {
                await this.clearPatternKeys(pattern);
            }

            console.log('All product caches cleared successfully');
        } catch (error) {
            console.error('Error clearing all product caches:', error);
        }
    }

    /**
     * پاکسازی کش یک محصول خاص
     */
    protected async clearProductCache(productId: string, language?: string): Promise<void> {
        const patterns = [
            `product:${productId}:*`,
            `product_detail:${productId}:*`,
            `price_strategies:${productId}:*`,
            `similar_products:${productId}:*`,
            `complementary:${productId}:*`
        ];

        if (language) {
            patterns.push(`product:${productId}:${language}`);
            patterns.push(`product_detail:${productId}:${language}`);
        }

        for (const pattern of patterns) {
            await this.clearPatternKeys(pattern);
        }
    }

    /**
     * پاکسازی کش‌های کاربر
     */
    protected async clearUserProductCaches(userId: string): Promise<void> {
        const patterns = [
            `user_products:${userId}:*`,
            `personalized_recs:${userId}:*`,
            `similar_to_viewed:${userId}:*`,
            `foryou:${userId}:*`
        ];

        for (const pattern of patterns) {
            await this.clearPatternKeys(pattern);
        }
    }

    /**
     * پاکسازی کش‌های مدیریتی
     */
    protected async clearAdminCaches(): Promise<void> {
        const patterns = [
            'admin_products:*',
            'review_stats:*',
            'product_audit:*'
        ];

        for (const pattern of patterns) {
            await this.clearPatternKeys(pattern);
        }
    }

    /**
     * پاکسازی کش‌های قیمت‌گذاری
     */
    protected async clearPriceCaches(productId: string): Promise<void> {
        const patterns = [
            `price_strategies:${productId}:*`,
            `price_calculation:${productId}:*`,
            `competitive_analysis:${productId}`
        ];

        for (const pattern of patterns) {
            await this.clearPatternKeys(pattern);
        }

        await this.clearProductCache(productId);
    }

    /**
     * پاکسازی کش‌های شخصی‌سازی
     */
    protected async clearPersonalizationCaches(accountUserId: string): Promise<void> {
        const patterns = [
            `personalized_recs:${accountUserId}:*`,
            `similar_to_viewed:${accountUserId}:*`,
            `foryou:${accountUserId}:*`,
            `complementary:*${accountUserId}*`
        ];

        for (const pattern of patterns) {
            await this.clearPatternKeys(pattern);
        }
    }

    // ==================== مدیریت TTL کش ====================

    /**
     * تنظیم TTL برای کش‌های مختلف
     */
    private getCacheTTL(cacheType: string): number {
        const ttlConfig: { [key: string]: number } = {
            // کش‌های کوتاه مدت (تغییرات مکرر)
            'product_detail': 10 * 60 * 1000, // 10 دقیقه
            'price_strategies': 5 * 60 * 1000, // 5 دقیقه
            'user_products': 2 * 60 * 1000, // 2 دقیقه

            // کش‌های میان مدت
            'product_search': 15 * 60 * 1000, // 15 دقیقه
            'public_products': 15 * 60 * 1000, // 15 دقیقه
            'category_products': 20 * 60 * 1000, // 20 دقیقه

            // کش‌های بلند مدت
            'featured_products': 30 * 60 * 1000, // 30 دقیقه
            'popular_products': 60 * 60 * 1000, // 1 ساعت
            'category_insights': 2 * 60 * 60 * 1000, // 2 ساعت

            // کش‌های شخصی‌سازی شده
            'personalized_recs': 15 * 60 * 1000, // 15 دقیقه
            'foryou': 20 * 60 * 1000, // 20 دقیقه

            // کش‌های مدیریتی
            'admin_products': 5 * 60 * 1000, // 5 دقیقه
            'review_stats': 10 * 60 * 1000, // 10 دقیقه
        };

        return ttlConfig[cacheType] || 5 * 60 * 1000; // پیش‌فرض 5 دقیقه
    }

    /**
     * تنظیم کش با TTL مناسب
     */
    protected async setCacheWithTTL(key: string, value: any, cacheType: string): Promise<void> {
        const ttl = this.getCacheTTL(cacheType);
        await this.cacheManager.set(key, value, ttl);
    }

    // ==================== utility methods ====================

    /**
     * لاگ کردن عملیات کش
     */
    private logCacheOperation(operation: string, key: string, success: boolean = true): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(`Cache ${operation}: ${key} - ${success ? 'SUCCESS' : 'FAILED'}`);
        }
    }

    /**
     * بررسی سلامت سیستم کش
     */
    // ==================== بررسی سلامت سیستم کش ====================
    async checkCacheHealth(): Promise<{ status: string; details: any }> {
        try {
            // تست ساده کش
            const testKey = 'health_check';
            const testValue = {
                timestamp: new Date().toISOString(),
                status: 'healthy'
            };

            await this.cacheManager.set(testKey, testValue, 1000);
            const retrievedValue = await this.cacheManager.get<{timestamp: string; status: string}>(testKey);

            // بررسی نوع داده‌ای با Type Guard
            const isHealthy = retrievedValue !== undefined &&
                retrievedValue !== null &&
                typeof retrievedValue === 'object' &&
                'timestamp' in retrievedValue &&
                'status' in retrievedValue &&
                retrievedValue.status === 'healthy';

            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                details: {
                    write: true,
                    read: retrievedValue !== undefined,
                    data_integrity: isHealthy,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: (error as Error).message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    // در ProductBaseService این متد رو اضافه کنید:

// ==================== غنی‌سازی محصول برای نمایش عمومی ====================
    protected enrichPublicProduct(product: any, language: Language): any {
        if (!product) return product;

        const content = product.contents?.[0] || {};
        const accountContent = product.account?.contents?.[0] || {};
        const userContent = product.user?.contents?.[0] || {};
        const categoryContent = product.category?.contents?.[0] || {};

        // قیمت اصلی از استراتژی قیمت‌گذاری
        const primaryPrice = product.pricing_strategies?.[0];
        const mainImage = product.files?.[0];

        return {
            // اطلاعات پایه
            id: product.id,
            created_at: product.created_at,
            updated_at: product.updated_at,

            // اطلاعات فنی
            stock: product.stock,
            min_sale_amount: product.min_sale_amount,
            unit: product.unit,
            status: product.status,
            has_video: product.has_video,

            // اطلاعات قیمت
            price_info: {
                final_price: primaryPrice?.final_price_amount,
                price_unit: primaryPrice?.price_unit,
                has_discount: primaryPrice?.has_discount,
                discount_percent: primaryPrice?.custom_adjustment_percent
            },

            // محتوای چندزبانه
            name: content.name,
            description: content.description,
            address: content.address,
            tags: content.tags || [],
            brand_name: content.brand_name,
            technical_specs: content.technical_specs,
            features: content.features || [],

            // اطلاعات دسته‌بندی
            category_info: {
                id: product.category_id,
                name: categoryContent.name || content.category_name
            },

            // اطلاعات حساب
            account_info: {
                id: product.account_id,
                name: accountContent.name || product.account?.name,
                activity_type: product.account?.activity_type,
                profile_photo: product.account?.profile_photo,
                is_verified: product.account?.confirmed
            },

            // اطلاعات کاربر
            user_info: {
                id: product.user_id,
                user_name: product.user?.user_name,
                full_name: `${userContent.first_name || ''} ${userContent.last_name || ''}`.trim(),
                is_verified: product.user?.is_verified
            },

            // رسانه‌ها
            media: {
                main_image: mainImage ? {
                    id: mainImage.id,
                    file_path: mainImage.file_path,
                    thumbnail_path: mainImage.thumbnail_path
                } : null,
                total_images: product._count?.files || 0
            },

            // آمار
            stats: {
                views: product.total_views || 0,
                likes: product.total_likes || 0,
                saves: product.total_saves || 0,
                reviews: product._count?.reviews || 0,
                interactions: product._count?.interactions || 0
            },

            // اطلاعات بوست
            boost_info: {
                is_boosted: product.boost_purchased,
                boost_power: product.boost_power,
                boost_expires_at: product.boost_expires_at,
                boost_is_elevated: product.boost_is_elevated
            }
        };
    }

}