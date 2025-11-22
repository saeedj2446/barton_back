// src/categories/categories.service.ts
import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AccountUserActivityService } from '../account-user-activity/account-user-activity.service';
import { UserActivityType, Language } from '@prisma/client';

import { CreateCategoryContentDto, } from './dto/category-content.dto';
import {UserBehaviorService} from "../ account-user-behavior/user-behavior.service";
import {UpdateCategoryContentDto} from "./dto/update-category-conten.dto";

@Injectable()
export class CategoriesService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private userBehaviorService: UserBehaviorService,
        private accountUserActivityService: AccountUserActivityService,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000;

    // ==================== متدهای اصلی با پشتیبانی چندزبانه ====================

    async create(createCategoryDto: CreateCategoryDto, language: Language = Language.fa) {
        return this.createWithTracking(createCategoryDto, language);
    }

    async getChildren(parentId?: string, language: Language = Language.fa) {
        return this.getChildrenWithTracking(parentId, language);
    }

    async findAll(query: CategoryQueryDto, language: Language = Language.fa) {
        return this.findAllWithTracking(query, language);
    }

    async findOne(id: string, language: Language = Language.fa, includeChildren: boolean = false) {
        return this.findOneWithTracking(id, language, includeChildren);
    }

    async findByBId(bId: number, language: Language = Language.fa) {
        return this.findByBIdWithTracking(bId, language);
    }

    async update(id: string, updateCategoryDto: UpdateCategoryDto, language: Language = Language.fa) {
        return this.updateWithTracking(id, updateCategoryDto, language);
    }

    async remove(id: string) {
        return this.removeWithTracking(id);
    }

    async getCategoryTree(parentId: string | null = null, language: Language = Language.fa) {
        return this.getCategoryTreeWithTracking(parentId, language);
    }

    async getCategoryStats() {
        const cacheKey = 'categories:stats';

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const [
            totalCategories,
            rootCategories,
            categoriesWithProducts,
            recentCategories,
        ] = await Promise.all([
            this.prisma.category.count(),
            this.prisma.category.count({ where: { parent_id: null } }),
            this.prisma.category.count({
                where: {
                    OR: [
                        { main_category_products: { some: {} } },
                        { sub_category_products: { some: {} } },
                    ],
                },
            }),
            this.prisma.category.count({
                where: {
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        const stats = {
            totalCategories,
            rootCategories,
            categoriesWithProducts,
            recentCategories,
            subCategories: totalCategories - rootCategories,
        };

        await this.cacheManager.set(cacheKey, stats, this.CACHE_TTL);
        return stats;
    }

    // ==================== متدهای جدید با ردیابی فعالیت و چندزبانه ====================

    async createWithTracking(
        createCategoryDto: CreateCategoryDto,
        language: Language = Language.fa,
        userId?: string,
        accountUserId?: string
    ) {
        if (createCategoryDto.bId) {
            const existingCategory = await this.prisma.category.findUnique({
                where: { bId: createCategoryDto.bId },
            });

            if (existingCategory) {
                throw new ConflictException('Category with this bId already exists');
            }
        }

        const categoryData: any = {
            parent_id: createCategoryDto.parent_id,
            bId: createCategoryDto.bId,
            metadata: createCategoryDto.metadata || {},
            contents: {
                create: createCategoryDto.contents.map(content => ({
                    language: content.language,
                    name: content.name,
                    description: content.description,
                    metadata: content.metadata,
                    auto_translated: content.auto_translated || true,
                }))
            }
        };

        const category = await this.prisma.category.create({
            data: categoryData,
            include: {
                contents: {
                    where: { language }
                }
            }
        });

        // 🔥 ردیابی فعالیت ایجاد دسته‌بندی
        if (userId && accountUserId) {
            const mainContent = createCategoryDto.contents.find(content => content.language === language) || createCategoryDto.contents[0];
            await this.trackCategoryActivity(accountUserId, category.id, 'PROFILE_UPDATE', {
                action: 'category_create',
                category_name: mainContent?.name,
                parent_id: category.parent_id,
                multilingual: createCategoryDto.contents.length > 1
            });
        }

        await this.clearCategoriesCache();
        return this.mergeMultilingualContent(category, language);
    }

    async findAllWithTracking(
        query: CategoryQueryDto,
        language: Language = Language.fa,
        userId?: string,
        accountUserId?: string
    ) {
        const cacheKey = this.getCategoriesCacheKey(query, language);

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 50, search, parent_id, include_children = false } = query;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (parent_id !== undefined && parent_id !== null) {
            where.parent_id = parent_id;
        } else {
            where.parent_id = null;
        }

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
            ];
        }

        const include = include_children ? this.getCategoryWithChildrenInclude(language) : this.getBasicCategoryInclude(language);

        const [categories, total] = await Promise.all([
            this.prisma.category.findMany({
                where,
                skip,
                take: limit,
                include,
                // 🔧 اصلاح OrderBy - استفاده از created_at به جای name که در مدل اصلی نیست
                orderBy: {
                    created_at: 'desc'
                },
            }),
            this.prisma.category.count({ where }),
        ]);

        // 🔥 ردیابی فعالیت جستجو در دسته‌بندی‌ها
        if (userId && accountUserId) {
            await this.trackCategorySearch(accountUserId, query);
        }

        const result = {
            data: categories.map(category => this.mergeMultilingualContent(category, language)),
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

    async findOneWithTracking(
        id: string,
        language: Language = Language.fa,
        includeChildren: boolean = false,
        userId?: string,
        accountUserId?: string
    ) {
        const cacheKey = `category:${id}:${language}:${includeChildren}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const include = includeChildren ? this.getDetailedCategoryInclude(language) : this.getBasicCategoryInclude(language);

        const category = await this.prisma.category.findUnique({
            where: { id },
            include,
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        // 🔥 ردیابی فعالیت مشاهده جزئیات دسته‌بندی
        if (userId && accountUserId) {
            await this.trackCategoryDetailView(accountUserId, category, includeChildren);
        }

        const mergedCategory = this.mergeMultilingualContent(category, language);
        await this.cacheManager.set(cacheKey, mergedCategory, this.CACHE_TTL);
        return mergedCategory;
    }

    async findByBIdWithTracking(
        bId: number,
        language: Language = Language.fa,
        userId?: string,
        accountUserId?: string
    ) {
        const cacheKey = `category:bId:${bId}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const category = await this.prisma.category.findUnique({
            where: { bId },
            include: this.getBasicCategoryInclude(language),
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        // 🔥 ردیابی فعالیت مشاهده دسته‌بندی
        if (userId && accountUserId) {
            await this.trackCategoryByBId(accountUserId, category);
        }

        const mergedCategory = this.mergeMultilingualContent(category, language);
        await this.cacheManager.set(cacheKey, mergedCategory, this.CACHE_TTL);
        return mergedCategory;
    }

    private async trackCategoryByBId(accountUserId: string, category: any) {
        try {
            await this.trackCategoryActivity(accountUserId, category.id, 'CATEGORY_VIEW', {
                category_name: category.name,
                by_bId: true,
                view_type: 'category_by_bid'
            });
        } catch (error) {
            console.error('Error tracking category by bId view:', error);
        }
    }

    async updateWithTracking(
        id: string,
        updateCategoryDto: UpdateCategoryDto,
        language: Language = Language.fa,
        userId?: string,
        accountUserId?: string
    ) {
        const existingCategory = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!existingCategory) {
            throw new NotFoundException('Category not found');
        }

        if (updateCategoryDto.bId && updateCategoryDto.bId !== existingCategory.bId) {
            const duplicateCategory = await this.prisma.category.findUnique({
                where: { bId: updateCategoryDto.bId },
            });

            if (duplicateCategory) {
                throw new ConflictException('Category with this bId already exists');
            }
        }

        // آماده‌سازی داده برای آپدیت
        const updateData: any = {
            ...updateCategoryDto,
        };

        // حذف contents از updateData اصلی چون جداگانه مدیریت می‌شود
        delete updateData.contents;

        // اگر محتوای چندزبانه برای آپدیت ارسال شده
        if (updateCategoryDto.contents && updateCategoryDto.contents.length > 0) {
            // ابتدا دسته‌بندی اصلی را آپدیت کن
            const updatedCategory = await this.prisma.category.update({
                where: { id },
                data: updateData,
            });

            // سپس محتوای چندزبانه را آپدیت یا ایجاد کن
            await Promise.all(
                updateCategoryDto.contents.map(content =>
                    this.prisma.categoryContent.upsert({
                        where: {
                            category_id_language: {
                                category_id: id,
                                language: content.language
                            }
                        },
                        create: {
                            category_id: id,
                            language: content.language,
                            name: content.name,
                            description: content.description,
                            metadata: content.metadata,
                            auto_translated: content.auto_translated || true,
                        },
                        update: {
                            name: content.name,
                            description: content.description,
                            metadata: content.metadata,
                            auto_translated: content.auto_translated,
                        }
                    })
                )
            );

            // دریافت دسته‌بندی با محتوای به‌روز شده
            const finalCategory = await this.prisma.category.findUnique({
                where: { id },
                include: {
                    contents: {
                        where: { language }
                    }
                }
            });

            // 🔥 ردیابی فعالیت
            if (userId && accountUserId) {
                await this.trackCategoryActivity(accountUserId, id, 'PROFILE_UPDATE', {
                    action: 'category_update',
                    updated_fields: Object.keys(updateCategoryDto),
                    multilingual: true
                });
            }

            await this.clearCategoryCache(id, existingCategory.bId, language);
            return this.mergeMultilingualContent(finalCategory, language);
        } else {
            // آپدیت ساده بدون محتوای چندزبانه
            const updatedCategory = await this.prisma.category.update({
                where: { id },
                data: updateData,
                include: {
                    contents: {
                        where: { language }
                    }
                }
            });

            // 🔥 ردیابی فعالیت
            if (userId && accountUserId) {
                await this.trackCategoryActivity(accountUserId, id, 'PROFILE_UPDATE', {
                    action: 'category_update',
                    updated_fields: Object.keys(updateCategoryDto)
                });
            }

            await this.clearCategoryCache(id, existingCategory.bId, language);
            return this.mergeMultilingualContent(updatedCategory, language);
        }
    }

    async removeWithTracking(id: string, userId?: string, accountUserId?: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: {
                contents: {
                    where: { language: Language.fa }, // استفاده از زبان پیش‌فرض برای نام
                    take: 1
                }
            }
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        const [childrenCount, mainProductsCount, subProductsCount] = await Promise.all([
            this.prisma.category.count({ where: { parent_id: id } }),
            this.prisma.product.count({ where: { category_id: id } }),
            this.prisma.product.count({ where: { sub_category_id: id } })
        ]);

        const totalProducts = mainProductsCount + subProductsCount;

        if (childrenCount > 0) {
            throw new ConflictException('Cannot delete category with subcategories');
        }

        if (totalProducts > 0) {
            throw new ConflictException('Cannot delete category with associated products');
        }

        await this.prisma.category.delete({
            where: { id },
        });

        // 🔥 ردیابی فعالیت حذف دسته‌بندی
        if (userId && accountUserId) {
            const categoryName = category.contents[0]?.name || `Category ${category.bId}`;
            await this.trackCategoryActivity(accountUserId, id, 'PROFILE_UPDATE', {
                action: 'category_delete',
                category_name: categoryName,
                bId: category.bId
            });
        }

        await this.clearCategoryCache(id, category.bId);
        return { message: 'Category deleted successfully' };
    }

    async getCategoryTreeWithTracking(
        parentId: string | null = null,
        language: Language = Language.fa,
        userId?: string,
        accountUserId?: string
    ) {
        const cacheKey = `category_tree:${parentId || 'root'}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const categories = await this.prisma.category.findMany({
            where: { parent_id: parentId },
            include: this.getCategoryTreeInclude(language),
            orderBy: {
                created_at: 'asc' // استفاده از created_at به جای name که در مدل اصلی نیست
            },
        });

        // 🔥 ردیابی فعالیت مشاهده درخت دسته‌بندی
        if (userId && accountUserId) {
            await this.trackCategoryView(accountUserId, parentId || 'root', 'CATEGORY_VIEW');
        }

        const mergedCategories = categories.map(category =>
            this.mergeMultilingualContent(category, language)
        );

        await this.cacheManager.set(cacheKey, mergedCategories, this.CACHE_TTL);
        return mergedCategories;
    }

    async getChildrenWithTracking(
        parentId?: string,
        language: Language = Language.fa,
        userId?: string,
        accountUserId?: string
    ) {
        const cacheKey = `categories_children:${parentId || 'root'}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const where: any = {};

        if (!parentId || parentId === 'null' || parentId === 'undefined') {
            where.parent_id = null;
        } else {
            where.parent_id = parentId;
        }

        const categories = await this.prisma.category.findMany({
            where,
            include: {
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        children: true,
                        main_category_products: true,
                        sub_category_products: true,
                    }
                }
            },
            orderBy: {
                created_at: 'asc' // استفاده از created_at به جای name که در مدل اصلی نیست
            },
        });

        // 🔥 ردیابی فعالیت مشاهده فرزندان دسته‌بندی
        if (userId && accountUserId) {
            await this.trackCategoryActivity(accountUserId, parentId || 'root', 'CATEGORY_VIEW', {
                view_type: 'category_children',
                children_count: categories.length
            });
        }

        const mergedCategories = categories.map(category =>
            this.mergeMultilingualContent(category, language)
        );

        await this.cacheManager.set(cacheKey, mergedCategories, 1000 * 60 * 1000);
        return mergedCategories;
    }

    // ==================== متدهای جدید برای تحلیل و آمار ====================

    async getPopularCategories(days: number = 30, limit: number = 10) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const categoryActivities = await this.prisma.accountUserActivity.groupBy({
            by: ['target_id'],
            where: {
                target_type: 'CATEGORY',
                created_at: { gte: sinceDate },
                activity_type: { in: ['CATEGORY_VIEW', 'PRODUCT_VIEW'] }
            },
            _count: true,
            orderBy: { _count: { target_id: 'desc' } },
            take: limit * 2
        });

        const categoryIds = categoryActivities.map(ca => ca.target_id).filter(Boolean) as string[];
        const categories = await this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            include: this.getBasicCategoryInclude(Language.fa),
        });

        const popularCategories = categories
            .map(category => {
                const activity = categoryActivities.find(ca => ca.target_id === category.id);
                const mergedCategory = this.mergeMultilingualContent(category, Language.fa);
                return {
                    ...mergedCategory,
                    activity_count: activity?._count || 0,
                    popularity_score: this.calculateCategoryPopularity(category, activity?._count || 0)
                };
            })
            .sort((a, b) => b.popularity_score - a.popularity_score)
            .slice(0, limit);

        return popularCategories;
    }

    async getPersonalizedCategories(accountUserId: string, limit: number = 10) {
        const cacheKey = `categories:personalized:${accountUserId}:${limit}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        // منطق پیشنهاد شخصی‌سازی شده
        const recommendedCategories = await this.getPopularCategories(30, limit);

        await this.cacheManager.set(cacheKey, recommendedCategories, this.CACHE_TTL / 2);
        return recommendedCategories;
    }

    async getUserEngagementAnalytics(days: number = 30) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const engagementStats = await this.prisma.accountUserActivity.groupBy({
            by: ['target_id', 'activity_type'],
            where: {
                target_type: 'CATEGORY',
                created_at: { gte: sinceDate }
            },
            _count: true,
            orderBy: { _count: { target_id: 'desc' } }
        });

        // گروه‌بندی بر اساس دسته‌بندی
        const categoryStats: Record<string, any> = {};

        engagementStats.forEach(stat => {
            if (!stat.target_id) return;

            if (!categoryStats[stat.target_id]) {
                categoryStats[stat.target_id] = {
                    category_id: stat.target_id,
                    total_activities: 0,
                    by_activity_type: {}
                };
            }

            categoryStats[stat.target_id].total_activities += stat._count;
            categoryStats[stat.target_id].by_activity_type[stat.activity_type] = stat._count;
        });

        // گرفتن اطلاعات دسته‌بندی‌ها
        const categoryIds = Object.keys(categoryStats);
        const categories = await this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            include: {
                contents: {
                    where: { language: Language.fa }
                }
            }
        });

        const result = Object.values(categoryStats).map((stat: any) => {
            const category = categories.find(c => c.id === stat.category_id);
            const mergedCategory = this.mergeMultilingualContent(category, Language.fa);
            return {
                ...stat,
                category_name: mergedCategory?.name || 'Unknown',
                category_bId: category?.bId
            };
        });

        return {
            period_days: days,
            total_activities: engagementStats.reduce((sum, stat) => sum + stat._count, 0),
            unique_categories: categoryIds.length,
            category_engagement: result.sort((a: any, b: any) => b.total_activities - a.total_activities)
        };
    }

    // ==================== متدهای مدیریت محتوای چندزبانه ====================

    async createCategoryContent(categoryId: string, contentDto: CreateCategoryContentDto) {
        const category = await this.prisma.category.findUnique({
            where: { id: categoryId }
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        const content = await this.prisma.categoryContent.create({
            data: {
                category_id: categoryId,
                language: contentDto.language,
                name: contentDto.name,
                description: contentDto.description,
                // 🔧 حذف auto_translated چون در مدل تعریف نشده
                // auto_translated: contentDto.auto_translated || false,
            }
        });

        await this.clearCategoryCache(categoryId, category.bId, contentDto.language);
        return content;
    }

    async updateCategoryContent(categoryId: string, language: Language, contentDto: UpdateCategoryContentDto) {
        const category = await this.prisma.category.findUnique({
            where: { id: categoryId }
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        const content = await this.prisma.categoryContent.update({
            where: {
                category_id_language: {
                    category_id: categoryId,
                    language
                }
            },
            data: contentDto
        });

        await this.clearCategoryCache(categoryId, category.bId, language);
        return content;
    }

    async getCategoryTranslations(categoryId: string) {
        return this.prisma.categoryContent.findMany({
            where: { category_id: categoryId },
            select: {
                language: true,
                name: true,
                description: true,
                auto_translated: true,
            }
        });
    }

    // ==================== متدهای کمکی چندزبانه ====================

    private mergeMultilingualContent(category: any, language: Language) {
        if (!category) return category;

        const content = category.contents?.find((c: any) => c.language === language);

        if (!content) {
            // اگر محتوای این زبان وجود نداشت، از محتوای پیش‌فرض استفاده کن
            return {
                ...category,
                name: category.name,
                description: category.description,
                contents: undefined // حذف از خروجی
            };
        }

        return {
            ...category,
            name: content.name,
            description: content.description,
            contents: undefined // حذف از خروجی
        };
    }

    // ==================== متدهای Include برای چندزبانه ====================

    private getBasicCategoryInclude(language: Language) {
        return {
            contents: {
                where: { language }
            },
            parent: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            _count: {
                select: {
                    children: true,
                    main_category_products: true,
                    sub_category_products: true,
                }
            }
        };
    }

    private getCategoryWithChildrenInclude(language: Language) {
        return {
            ...this.getBasicCategoryInclude(language),
            children: {
                include: {
                    contents: {
                        where: { language }
                    },
                    _count: {
                        select: {
                            children: true,
                            main_category_products: true,
                        }
                    }
                }
            }
        };
    }

    private getDetailedCategoryInclude(language: Language) {
        return {
            ...this.getBasicCategoryInclude(language),
            children: {
                include: {
                    contents: {
                        where: { language }
                    },
                    _count: {
                        select: {
                            children: true,
                            main_category_products: true,
                        }
                    }
                }
            }
        };
    }

    private getCategoryTreeInclude(language: Language) {
        return {
            contents: {
                where: { language }
            },
            children: {
                include: {
                    contents: {
                        where: { language }
                    },
                    children: {
                        include: {
                            contents: {
                                where: { language }
                            },
                            children: {
                                include: {
                                    contents: {
                                        where: { language }
                                    },
                                }
                            }
                        }
                    }
                }
            },
            _count: {
                select: {
                    main_category_products: true,
                    sub_category_products: true,
                }
            }
        };
    }

    // ==================== متدهای ردیابی فعالیت ====================

    private async trackCategoryActivity(
        accountUserId: string,
        categoryId: string,
        activityType: UserActivityType,
        metadata?: Record<string, any>
    ) {
        try {
            await this.accountUserActivityService.trackActivity({
                account_user_id: accountUserId,
                activity_type: activityType,
                target_type: 'CATEGORY',
                target_id: categoryId,
                category_id: categoryId,
                metadata: metadata || {},
                weight: this.getCategoryActivityWeight(activityType)
            });
        } catch (error) {
            console.error(`Failed to track ${activityType} activity for category:`, error);
        }
    }

    private async trackCategoryView(accountUserId: string, categoryId: string, activityType: UserActivityType) {
        try {
            await this.trackCategoryActivity(accountUserId, categoryId, activityType, {
                view_type: activityType === 'CATEGORY_VIEW' ? 'category_list' : 'category_tree'
            });
        } catch (error) {
            console.error('Error tracking category view:', error);
        }
    }

    private async trackCategorySearch(accountUserId: string, query: CategoryQueryDto) {
        try {
            await this.accountUserActivityService.trackActivity({
                account_user_id: accountUserId,
                activity_type: 'SEARCH_QUERY',
                target_type: 'CATEGORY',
                metadata: {
                    search_query: query.search,
                    parent_id: query.parent_id,
                    include_children: query.include_children,
                    search_type: 'category_search'
                },
                weight: 2
            });
        } catch (error) {
            console.error('Failed to track category search activity:', error);
        }
    }

    private async trackCategoryDetailView(accountUserId: string, category: any, includeChildren: boolean) {
        try {
            await this.accountUserActivityService.trackActivity({
                account_user_id: accountUserId,
                activity_type: 'CATEGORY_VIEW',
                target_type: 'CATEGORY',
                target_id: category.id,
                metadata: {
                    category_name: category.name,
                    has_children: includeChildren,
                    view_type: 'category_detail',
                    by_bId: false
                },
                weight: 1
            });
        } catch (error) {
            console.error('Error tracking category detail view:', error);
        }
    }

    // ==================== متدهای تحلیل و آنالیز ====================

    private async analyzeUserCategoryPreferences(accountUserId: string, userActivities: any): Promise<string[]> {
        const categoryCount: Record<string, number> = {};

        (userActivities.data || []).forEach((activity: any) => {
            if (activity.target_type === 'CATEGORY' && activity.target_id) {
                categoryCount[activity.target_id] = (categoryCount[activity.target_id] || 0) + 1;
            }

            // تحلیل محصولات دیده شده برای استخراج دسته‌بندی‌ها
            if (activity.activity_type === 'PRODUCT_VIEW' && activity.metadata?.category_id) {
                categoryCount[activity.metadata.category_id] = (categoryCount[activity.metadata.category_id] || 0) + 1;
            }
        });

        return Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([categoryId]) => categoryId);
    }

    private async getCategoriesByPreferences(favoriteCategoryIds: string[], limit: number) {
        const categories = await this.prisma.category.findMany({
            where: {
                OR: [
                    { id: { in: favoriteCategoryIds } },
                    { parent_id: { in: favoriteCategoryIds } }
                ]
            },
            include: this.getBasicCategoryInclude(Language.fa),
            take: limit
        });

        return categories.map(category => {
            const mergedCategory = this.mergeMultilingualContent(category, Language.fa);
            return {
                ...mergedCategory,
                recommendation_reason: favoriteCategoryIds.includes(category.id) ?
                    'based_on_your_activity' : 'related_to_your_interests'
            };
        });
    }

    private calculateCategoryPopularity(category: any, activityCount: number): number {
        const productCount = (category._count?.main_category_products || 0) + (category._count?.sub_category_products || 0);
        const subCategoryCount = category._count?.children || 0;

        return (activityCount * 3) + (productCount * 2) + (subCategoryCount * 1);
    }

    private getCategoryActivityWeight(activityType: UserActivityType): number {
        const weights = {
            'CATEGORY_VIEW': 1,
            'PRODUCT_VIEW': 2,
            'SEARCH_QUERY': 3,
            'PROFILE_UPDATE': 5
        };

        return weights[activityType] || 1;
    }

    // ==================== متدهای مدیریت کش ====================

    private getCategoriesCacheKey(query: CategoryQueryDto, language: Language): string {
        return `categories:${language}:${JSON.stringify(query)}`;
    }

    private async clearCategoryCache(categoryId: string, bId: number, language?: Language) {
        const cacheKeys = [
            `category:${categoryId}:${language || '*'}`,
            `category:bId:${bId}:${language || '*'}`,
            'categories:stats',
        ];

        if (language) {
            cacheKeys.push(`category:${categoryId}:${language}`);
            cacheKeys.push(`category:bId:${bId}:${language}`);
        } else {
            // پاک کردن کش برای همه زبان‌ها
            Object.values(Language).forEach(lang => {
                cacheKeys.push(`category:${categoryId}:${lang}`);
                cacheKeys.push(`category:bId:${bId}:${lang}`);
            });
        }

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
        await this.clearCategoriesCache(language);
    }

    private async clearCategoriesCache(language?: Language) {
        try {
            const knownKeys = [
                'categories:stats',
                'categories:popular',
                'categories:personalized'
            ];

            // پاک کردن کش برای تمام زبان‌ها
            if (language) {
                const languageKeys = knownKeys.map(key => `${key}:${language}`);
                await Promise.all(languageKeys.map(key => this.cacheManager.del(key)));
            } else {
                // پاک کردن کش برای همه زبان‌ها
                const allLanguageKeys = Object.values(Language).flatMap(lang =>
                    knownKeys.map(key => `${key}:${lang}`)
                );
                await Promise.all(allLanguageKeys.map(key => this.cacheManager.del(key)));
            }
        } catch (error) {
            console.error('Error clearing categories cache:', error);
        }
    }
}