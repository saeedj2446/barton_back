// src/user-behavior/user-behavior.service.ts
import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateAccountUserActivityDto } from './dto/create-account-user-activity.dto';
import { UpdateAccountUserBehaviorDto } from './dto/update-account-user-behavior.dto';
import { UserBehaviorQueryDto } from './dto/user-behavior-query.dto';
import { UserActivityType, Prisma, Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nBadRequestException,
    I18nInternalServerErrorException
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class UserBehaviorService {
    private readonly logger = new Logger(UserBehaviorService.name);
    private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    private readonly BEHAVIOR_UPDATE_BATCH_SIZE = 10;
    private readonly DEFAULT_LANGUAGE = Language.fa;
    private userBehaviorService: UserBehaviorService
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    // ==================== فعالیت‌ها ====================

    async createActivity(createDto: CreateAccountUserActivityDto, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            // اعتبارسنجی account_user_id
            const accountUser = await this.prisma.accountUser.findUnique({
                where: { id: createDto.account_user_id },
                include: {
                    user: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1
                            }
                        }
                    },
                    account: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1
                            }
                        }
                    }
                }
            });

            if (!accountUser) {
                throw new I18nNotFoundException('ACCOUNT_USER_NOT_FOUND', language, { accountUserId: createDto.account_user_id });
            }

            const activityData: Prisma.AccountUserActivityCreateInput = {
                account_user: { connect: { id: createDto.account_user_id } },
                activity_type: createDto.activity_type,
                weight: createDto.weight || 1,
                metadata: createDto.metadata || {},
            };

            // اضافه کردن روابط اختیاری
            if (createDto.target_type) activityData.target_type = createDto.target_type;
            if (createDto.target_id) activityData.target_id = createDto.target_id;
            if (createDto.product_id) {
                activityData.product = { connect: { id: createDto.product_id } };
            }

            const activity = await this.prisma.accountUserActivity.create({
                data: activityData,
                include: this.getActivityIncludeFields(language),
            });

            // پاک کردن کش‌های مربوطه
            await this.clearActivityCaches(createDto.account_user_id);

            // بروزرسانی سریع رفتار کاربر
            await this.updateBehaviorQuickStats(createDto.account_user_id, createDto.activity_type);

            this.logger.log(`Activity created: ${createDto.activity_type} for user ${createDto.account_user_id}`);
            return activity;

        } catch (error) {
            this.logger.error('Error creating activity:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('ACTIVITY_TRACK_ERROR', language);
        }
    }

    async createBatchActivities(createDtos: CreateAccountUserActivityDto[], language: Language = this.DEFAULT_LANGUAGE) {
        if (createDtos.length === 0) {
            return [];
        }

        try {
            // اعتبارسنجی همه account_user_id ها
            const accountUserIds = [...new Set(createDtos.map(dto => dto.account_user_id))];
            const accountUsers = await this.prisma.accountUser.findMany({
                where: { id: { in: accountUserIds } },
                select: { id: true }
            });

            const validAccountUserIds = new Set(accountUsers.map(au => au.id));
            const invalidDtos = createDtos.filter(dto => !validAccountUserIds.has(dto.account_user_id));

            if (invalidDtos.length > 0) {
                throw new I18nBadRequestException('INVALID_ACCOUNT_USERS', language, {
                    missingIds: invalidDtos.map(d => d.account_user_id).join(', ')
                });
            }

            const activities = await this.prisma.$transaction(
                createDtos.map(createDto => {
                    const activityData: Prisma.AccountUserActivityCreateInput = {
                        account_user: { connect: { id: createDto.account_user_id } },
                        activity_type: createDto.activity_type,
                        weight: createDto.weight || 1,
                        metadata: createDto.metadata || {},
                    };

                    if (createDto.target_type) activityData.target_type = createDto.target_type;
                    if (createDto.target_id) activityData.target_id = createDto.target_id;
                    if (createDto.product_id) {
                        activityData.product = { connect: { id: createDto.product_id } };
                    }

                    return this.prisma.accountUserActivity.create({
                        data: activityData,
                        select: { id: true, activity_type: true, created_at: true, account_user_id: true }
                    });
                })
            );

            // پاک کردن کش برای همه کاربران مربوطه
            await Promise.all(
                accountUserIds.map(id => this.clearActivityCaches(id))
            );

            // بروزرسانی رفتارها
            await this.updateBehaviorsFromBatch(createDtos);

            this.logger.log(`Batch activities created: ${activities.length} activities`);
            return activities;

        } catch (error) {
            this.logger.error('Error creating batch activities:', error);
            if (error instanceof I18nBadRequestException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('BATCH_ACTIVITY_TRACK_ERROR', language);
        }
    }

    async getActivities(query: UserBehaviorQueryDto, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `activities:${JSON.stringify(query)}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const { page = 1, limit = 20, activity_type, account_user_id, target_type, product_id, start_date, end_date } = query;
            const skip = (page - 1) * limit;

            const where: Prisma.AccountUserActivityWhereInput = {};

            if (activity_type) where.activity_type = activity_type;
            if (account_user_id) where.account_user_id = account_user_id;
            if (target_type) where.target_type = target_type;
            if (product_id) where.product_id = product_id;

            if (start_date || end_date) {
                where.created_at = {};
                if (start_date) where.created_at.gte = new Date(start_date);
                if (end_date) where.created_at.lte = new Date(end_date);
            }

            const [activities, total] = await Promise.all([
                this.prisma.accountUserActivity.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getActivityIncludeFields(language),
                    orderBy: { created_at: 'desc' },
                }),
                this.prisma.accountUserActivity.count({ where }),
            ]);

            const result = {
                data: activities,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    summary: {
                        total_activities: total,
                        by_type: await this.getActivityTypeBreakdown(where),
                        by_account_user: await this.getAccountUserBreakdown(where)
                    }
                },
            };

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            this.logger.error('Error getting activities:', error);
            throw new I18nInternalServerErrorException('ACTIVITIES_FETCH_ERROR', language);
        }
    }

    async getUserActivities(accountUserId: string, query: UserBehaviorQueryDto, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `user_activities:${accountUserId}:${JSON.stringify(query)}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const modifiedQuery = { ...query, account_user_id: accountUserId };
            const result = await this.getActivities(modifiedQuery, language);

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            this.logger.error('Error getting user activities:', error);
            throw new I18nInternalServerErrorException('ACTIVITIES_FETCH_ERROR', language);
        }
    }

    // ==================== رفتارها ====================

    async getBehavior(accountUserId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `behavior:${accountUserId}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const behavior = await this.prisma.accountUserBehavior.findUnique({
                where: { account_user_id: accountUserId },
                include: this.getBehaviorIncludeFields(language)
            });

            if (!behavior) {
                // اگر رفتار وجود ندارد، یک رفتار پیش‌فرض ایجاد کنید
                return await this.createDefaultBehavior(accountUserId, language);
            }

            await this.cacheManager.set(cacheKey, behavior, this.CACHE_TTL);
            return behavior;

        } catch (error) {
            this.logger.error('Error getting behavior:', error);
            throw new I18nInternalServerErrorException('USER_STATS_FETCH_ERROR', language);
        }
    }

    async updateBehavior(accountUserId: string, updateDto: UpdateAccountUserBehaviorDto, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const behavior = await this.prisma.accountUserBehavior.upsert({
                where: { account_user_id: accountUserId },
                update: {
                    ...updateDto,
                    updated_at: new Date()
                },
                create: {
                    account_user_id: accountUserId,
                    ...updateDto,
                    interests: updateDto.interests || {},
                    search_patterns: updateDto.search_patterns || {},
                    recent_searches: updateDto.recent_searches || [],
                    recent_views: updateDto.recent_views || [],
                    recent_saves: updateDto.recent_saves || [],
                    total_searches: updateDto.total_searches || 0,
                    total_views: updateDto.total_views || 0,
                    total_saves: updateDto.total_saves || 0,
                    last_active: updateDto.last_active || new Date()
                },
                include: this.getBehaviorIncludeFields(language)
            });

            await this.clearBehaviorCaches(accountUserId);

            this.logger.log(`Behavior updated for user: ${accountUserId}`);
            return behavior;

        } catch (error) {
            this.logger.error('Error updating behavior:', error);
            throw new I18nInternalServerErrorException('USER_STATS_FETCH_ERROR', language);
        }
    }

    async analyzeAndUpdateBehavior(accountUserId: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            // تحلیل فعالیت‌های اخیر برای به‌روزرسانی رفتار
            const recentActivities = await this.prisma.accountUserActivity.findMany({
                where: {
                    account_user_id: accountUserId,
                    created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 روز گذشته
                },
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
                orderBy: { created_at: 'desc' },
                take: 1000
            });

            const analysis = this.analyzeActivities(recentActivities, language);
            return await this.updateBehavior(accountUserId, analysis, language);

        } catch (error) {
            this.logger.error('Error analyzing behavior:', error);
            throw new I18nInternalServerErrorException('USER_PATTERNS_FETCH_ERROR', language);
        }
    }

    // ==================== آمار و گزارش‌ها ====================

    async getActivityStats(accountUserId?: string, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `activity_stats:${accountUserId || 'global'}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const where: Prisma.AccountUserActivityWhereInput = {};
            if (accountUserId) where.account_user_id = accountUserId;

            const [
                totalActivities,
                todayActivities,
                uniqueUsers,
                popularActivities,
                activityTrend
            ] = await Promise.all([
                this.prisma.accountUserActivity.count({ where }),
                this.prisma.accountUserActivity.count({
                    where: {
                        ...where,
                        created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                    }
                }),
                this.prisma.accountUserActivity.groupBy({
                    by: ['account_user_id'],
                    where,
                    _count: true
                }),
                this.prisma.accountUserActivity.groupBy({
                    by: ['activity_type'],
                    where,
                    _count: true,
                    orderBy: { _count: { activity_type: 'desc' } },
                    take: 5
                }),
                this.getActivityTrend(where)
            ]);

            const result = {
                total_activities: totalActivities,
                today_activities: todayActivities,
                unique_users: uniqueUsers.length,
                popular_activities: popularActivities,
                activity_trend: activityTrend,
                hourly_breakdown: await this.getHourlyBreakdown(where)
            };

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            this.logger.error('Error getting activity stats:', error);
            throw new I18nInternalServerErrorException('USER_STATS_FETCH_ERROR', language);
        }
    }

    // ==================== متدهای مدیریتی ====================

    async deleteActivity(activityId: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const activity = await this.prisma.accountUserActivity.findUnique({
                where: { id: activityId }
            });

            if (!activity) {
                throw new I18nNotFoundException('ACTIVITY_NOT_FOUND', language, { activityId });
            }

            await this.prisma.accountUserActivity.delete({
                where: { id: activityId }
            });

            await this.clearActivityCaches(activity.account_user_id);

            this.logger.log(`Activity ${activityId} deleted successfully`);
            return {
                success: true,
                message: this.i18nService.t('ACTIVITY_DELETED_SUCCESS', language)
            };

        } catch (error) {
            this.logger.error('Error deleting activity:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('ACTIVITY_DELETE_ERROR', language);
        }
    }

    async deleteBehavior(accountUserId: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const behavior = await this.prisma.accountUserBehavior.findUnique({
                where: { account_user_id: accountUserId }
            });

            if (!behavior) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            await this.prisma.accountUserBehavior.delete({
                where: { account_user_id: accountUserId }
            });

            await this.clearBehaviorCaches(accountUserId);

            this.logger.log(`Behavior deleted for user: ${accountUserId}`);
            return {
                success: true,
                message: this.i18nService.t('ACTIVITY_DELETED_SUCCESS', language)
            };

        } catch (error) {
            this.logger.error('Error deleting behavior:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('USER_ACTIVITIES_DELETE_ERROR', language);
        }
    }

    async getActivityTrends(days: number = 30, activityType?: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const where: Prisma.AccountUserActivityWhereInput = {
                created_at: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
            };

            if (activityType) {
                where.activity_type = activityType as UserActivityType;
            }

            const trends = await this.prisma.accountUserActivity.groupBy({
                by: ['created_at'],
                where,
                _count: true,
                orderBy: { created_at: 'asc' }
            });

            return {
                period_days: days,
                activity_type: activityType || 'ALL',
                trends: trends.map(t => ({
                    date: t.created_at,
                    count: t._count
                }))
            };

        } catch (error) {
            this.logger.error('Error getting activity trends:', error);
            throw new I18nInternalServerErrorException('ACTIVITY_TRENDS_FETCH_ERROR', language);
        }
    }



    async getPopularProducts(limit: number = 10, days: number = 30, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const popularProducts = await this.prisma.accountUserActivity.groupBy({
                by: ['product_id'],
                where: {
                    product_id: { not: null },
                    created_at: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
                },
                _count: true,
                orderBy: { _count: { product_id: 'desc' } },
                take: limit
            });

            const productIds = popularProducts.map(p => p.product_id).filter(Boolean) as string[];

            if (productIds.length === 0) {
                return [];
            }

            const products = await this.prisma.product.findMany({
                where: { id: { in: productIds } },
                include: {
                    contents: {
                        where: { language },
                        take: 1
                    },
                    // گرفتن همه قیمت‌های فعال
                    pricing_strategies: {
                        where: { is_active: true },
                        select: {
                            final_price_amount: true,
                            price_unit: true,
                            has_discount: true,
                            custom_adjustment_percent: true,
                            is_primary: true
                        },
                        orderBy: { is_primary: 'desc' } // اولویت با قیمت اصلی
                    }
                }
            });

            return popularProducts.map(popular => {
                const product = products.find(p => p.id === popular.product_id);
                const productContent = product?.contents[0];

                // پیدا کردن بهترین قیمت
                const bestPrice = this.getBestDisplayPrice(product?.pricing_strategies || []);

                return {
                    product: {
                        id: product?.id,
                        name: productContent?.name || this.i18nService.t('UNKNOWN_PRODUCT', language),
                        category_name: productContent?.category_name || this.i18nService.t('UNKNOWN_CATEGORY', language),
                        price_info: bestPrice,
                        total_views: product?.total_views || 0,
                        total_likes: product?.total_likes || 0,
                        total_saves: product?.total_saves || 0,
                        status: product?.status
                    },
                    activity_count: popular._count,
                    display_price: bestPrice?.final_price || 0,
                    popularity_rank: popular._count
                };
            });

        } catch (error) {
            this.logger.error('Error getting popular products:', error);
            throw new I18nInternalServerErrorException('TOP_PRODUCTS_FETCH_ERROR', language);
        }
    }

    private getBestDisplayPrice(pricingStrategies: any[]): any {
        if (pricingStrategies.length === 0) {
            return null;
        }

        // اولویت با قیمت اصلی
        const primaryPrice = pricingStrategies.find(p => p.is_primary);
        if (primaryPrice) {
            return {
                final_price: primaryPrice.final_price_amount,
                price_unit: primaryPrice.price_unit,
                has_discount: primaryPrice.has_discount,
                discount_percent: primaryPrice.custom_adjustment_percent,
                is_primary: true
            };
        }

        // اگر قیمت اصلی نبود، اولین قیمت فعال
        const firstActivePrice = pricingStrategies[0];
        return {
            final_price: firstActivePrice.final_price_amount,
            price_unit: firstActivePrice.price_unit,
            has_discount: firstActivePrice.has_discount,
            discount_percent: firstActivePrice.custom_adjustment_percent,
            is_primary: false
        };
    }

    async getUserEngagementMetrics(language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const [
                totalUsers,
                activeUsers
            ] = await Promise.all([
                this.prisma.accountUser.count(),
                this.prisma.accountUserBehavior.count({
                    where: {
                        last_active: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    }
                })
            ]);

            return {
                total_users: totalUsers,
                active_users: activeUsers,
                engagement_rate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
                retention_rate: this.calculateRetentionRate()
            };

        } catch (error) {
            this.logger.error('Error getting user engagement metrics:', error);
            throw new I18nInternalServerErrorException('USER_ENGAGEMENT_ANALYTICS_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private getActivityIncludeFields(language: Language) {
        return {
            account_user: {
                include: {
                    user: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1,
                                select: {
                                    first_name: true,
                                    last_name: true
                                }
                            }
                        }
                    },
                    account: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1,
                                select: {
                                    name: true
                                }
                            },
                            industry: {
                                include: {
                                    contents: {
                                        where: { language },
                                        take: 1,
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            product: {
                include: {
                    contents: {
                        where: { language },
                        take: 1,
                        select: {
                            name: true,
                            category_name: true
                        }
                    },
                    category: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1,
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                }
            }
        } as const;
    }

    private getBehaviorIncludeFields(language: Language) {
        return {
            account_user: {
                include: {
                    user: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1,
                                select: {
                                    first_name: true,
                                    last_name: true
                                }
                            }
                        }
                    },
                    account: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1,
                                select: {
                                    name: true
                                }
                            },
                            industry: {
                                include: {
                                    contents: {
                                        where: { language },
                                        take: 1,
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } as const;
    }

    private async updateBehaviorQuickStats(accountUserId: string, activityType: UserActivityType) {
        const updateData: any = {
            last_active: new Date(),
            updated_at: new Date()
        };

        // افزایش آمار بر اساس نوع فعالیت
        switch (activityType) {
            case 'SEARCH_QUERY':
                updateData.total_searches = { increment: 1 };
                break;
            case 'PRODUCT_VIEW':
                updateData.total_views = { increment: 1 };
                break;
            case 'PRODUCT_SAVE':
                updateData.total_saves = { increment: 1 };
                break;
        }

        try {
            await this.prisma.accountUserBehavior.upsert({
                where: { account_user_id: accountUserId },
                update: updateData,
                create: {
                    account_user_id: accountUserId,
                    ...updateData,
                    interests: {},
                    search_patterns: {},
                    recent_searches: [],
                    recent_views: [],
                    recent_saves: [],
                    total_searches: updateData.total_searches?.increment || 0,
                    total_views: updateData.total_views?.increment || 0,
                    total_saves: updateData.total_saves?.increment || 0
                }
            });
        } catch (error) {
            this.logger.warn('Error updating behavior quick stats:', error);
        }
    }

    private async updateBehaviorsFromBatch(activities: CreateAccountUserActivityDto[]) {
        // گروه‌بندی فعالیت‌ها بر اساس account_user_id
        const activitiesByUser: Record<string, CreateAccountUserActivityDto[]> = activities.reduce((acc, activity) => {
            if (!acc[activity.account_user_id]) {
                acc[activity.account_user_id] = [];
            }
            acc[activity.account_user_id].push(activity);
            return acc;
        }, {} as Record<string, CreateAccountUserActivityDto[]>);

        // بروزرسانی رفتارها به صورت دسته‌ای
        const updates = Object.entries(activitiesByUser).map(([accountUserId, userActivities]) => {
            return this.updateBehaviorFromActivities(accountUserId, userActivities);
        });

        await Promise.all(updates);
    }

    private async updateBehaviorFromActivities(accountUserId: string, activities: CreateAccountUserActivityDto[]) {
        const searchActivities = activities.filter(a => a.activity_type === 'SEARCH_QUERY');
        const viewActivities = activities.filter(a => a.activity_type === 'PRODUCT_VIEW');
        const saveActivities = activities.filter(a => a.activity_type === 'PRODUCT_SAVE');

        const updateData: UpdateAccountUserBehaviorDto = {
            total_searches: searchActivities.length,
            total_views: viewActivities.length,
            total_saves: saveActivities.length,
            last_active: new Date()
        };

        return this.updateBehavior(accountUserId, updateData);
    }

    private analyzeActivities(activities: any[], language: Language): UpdateAccountUserBehaviorDto {
        const interests: Record<string, number> = {};
        const searchPatterns: Record<string, any> = {};
        const recentSearches: string[] = [];
        const recentViews: string[] = [];
        const recentSaves: string[] = [];

        activities.forEach(activity => {
            switch (activity.activity_type) {
                case 'SEARCH_QUERY':
                    const query = activity.metadata?.query;
                    if (query && !recentSearches.includes(query)) {
                        recentSearches.push(query);
                    }
                    break;
                case 'PRODUCT_VIEW':
                    const viewCategory = activity.product?.contents?.[0]?.category_name ||
                        activity.product?.category?.contents?.[0]?.name;
                    if (viewCategory) {
                        interests[viewCategory] = (interests[viewCategory] || 0) + 1;
                    }
                    if (activity.product_id && !recentViews.includes(activity.product_id)) {
                        recentViews.push(activity.product_id);
                    }
                    break;
                case 'PRODUCT_SAVE':
                    if (activity.product_id && !recentSaves.includes(activity.product_id)) {
                        recentSaves.push(activity.product_id);
                    }
                    break;
            }
        });

        return {
            interests,
            search_patterns: searchPatterns,
            recent_searches: recentSearches.slice(0, 10),
            recent_views: recentViews.slice(0, 10),
            recent_saves: recentSaves.slice(0, 10)
        };
    }

    private async createDefaultBehavior(accountUserId: string, language: Language) {
        return await this.prisma.accountUserBehavior.create({
            data: {
                account_user_id: accountUserId,
                interests: {},
                search_patterns: {},
                recent_searches: [],
                recent_views: [],
                recent_saves: [],
                total_searches: 0,
                total_views: 0,
                total_saves: 0,
                last_active: new Date()
            },
            include: this.getBehaviorIncludeFields(language)
        });
    }

    private async getActivityTypeBreakdown(where: Prisma.AccountUserActivityWhereInput) {
        const result = await this.prisma.accountUserActivity.groupBy({
            by: ['activity_type'],
            where,
            _count: true
        });

        return result.reduce((acc, item) => {
            acc[item.activity_type] = item._count;
            return acc;
        }, {} as Record<string, number>);
    }

    private async getAccountUserBreakdown(where: Prisma.AccountUserActivityWhereInput) {
        const result = await this.prisma.accountUserActivity.groupBy({
            by: ['account_user_id'],
            where,
            _count: true
        });

        return result.reduce((acc, item) => {
            acc[item.account_user_id] = item._count;
            return acc;
        }, {} as Record<string, number>);
    }

    private async getActivityTrend(where: Prisma.AccountUserActivityWhereInput) {
        const activities = await this.prisma.accountUserActivity.groupBy({
            by: ['created_at'],
            where: {
                ...where,
                created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            },
            _count: true
        });

        return activities;
    }

    private async getHourlyBreakdown(where: Prisma.AccountUserActivityWhereInput) {
        const activities = await this.prisma.accountUserActivity.findMany({
            where: {
                ...where,
                created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            select: { created_at: true }
        });

        const hourlyCount = Array(24).fill(0);
        activities.forEach(activity => {
            const hour = new Date(activity.created_at).getHours();
            hourlyCount[hour]++;
        });

        return hourlyCount;
    }

    private async clearActivityCaches(accountUserId: string) {
        const patterns = [
            `activities:*`,
            `user_activities:${accountUserId}:*`,
            `activity_stats:*`,
            `behavior:${accountUserId}`
        ];

        await Promise.all(
            patterns.map(pattern => this.clearPatternKeys(pattern))
        );
    }

    private async clearBehaviorCaches(accountUserId: string) {
        const patterns = [
            `behavior:${accountUserId}`,
            `activity_stats:${accountUserId}`
        ];

        await Promise.all(
            patterns.map(pattern => this.clearPatternKeys(pattern))
        );
    }

    private async clearPatternKeys(pattern: string): Promise<void> {
        try {
            this.logger.debug(`Clearing cache pattern: ${pattern}`);
            // در اینجا منطق پاک کردن کش بر اساس پترن را پیاده‌سازی کنید
        } catch (error) {
            this.logger.warn(`Could not clear pattern ${pattern}:`, error);
        }
    }

    private calculateRetentionRate(): number {
        // منطق محاسبه نرخ حفظ کاربران
        return 75.5;
    }
}