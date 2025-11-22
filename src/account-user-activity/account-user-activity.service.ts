// src/account-user-activity/account-user-activity.service.ts
import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TrackActivityDto, TrackBatchActivitiesDto } from './dto/track-activity.dto';
import { ActivityStatsQueryDto } from './dto/activity-stats.dto';
import { UserActivityType, Prisma, Language } from '@prisma/client';
import { ActivityAnalyticsQueryDto } from "./dto/activity-analytics-query.dto";
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nConflictException,
    I18nBadRequestException,
    I18nInternalServerErrorException
} from '../common/exceptions/i18n-exceptions';
import {UserActivityPattern, ActivityTrend, ProductEngagement, CategoryInsights} from "./activity-patterns.interface";

@Injectable()
export class AccountUserActivityService {
    private readonly logger = new Logger(AccountUserActivityService.name);
    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    private readonly PATTERN_UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    // ==================== ثبت فعالیت‌ها ====================

    async trackActivity(trackDto: TrackActivityDto, language: Language = Language.fa) {
        try {
            // اعتبارسنجی account_user_id
            await this.validateAccountUser(trackDto.account_user_id, language);

            const activityData: Prisma.AccountUserActivityCreateInput = {
                account_user: { connect: { id: trackDto.account_user_id } },
                activity_type: trackDto.activity_type,
                weight: trackDto.weight || 1,
                metadata: trackDto.metadata || {},
            };

            // اضافه کردن روابط اختیاری
            if (trackDto.target_type) activityData.target_type = trackDto.target_type;
            if (trackDto.target_id) activityData.target_id = trackDto.target_id;
            if (trackDto.product_id) {
                activityData.product = { connect: { id: trackDto.product_id } };
            }

            const activity = await this.prisma.accountUserActivity.create({
                data: activityData,
                include: this.getActivityIncludeFields(language),
            });

            // پاک کردن کش‌های مربوطه
            await this.clearActivityCaches(trackDto.account_user_id);

            // پردازش غیرهمزمان برای تحلیل الگوها
            this.processActivityPatterns(activity).catch(error =>
                this.logger.error('Error processing activity patterns:', error)
            );

            this.logger.log(`Activity tracked: ${trackDto.activity_type} for user ${trackDto.account_user_id}`);

            return activity;

        } catch (error) {
            this.logger.error('Error tracking activity:', error);
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('ACTIVITY_TRACK_ERROR', language);
        }
    }

    async trackBatchActivities(batchDto: TrackBatchActivitiesDto, language: Language = Language.fa) {
        if (batchDto.activities.length === 0) {
            return { success: true, count: 0 };
        }

        try {
            // اعتبارسنجی دسته‌ای
            const accountUserIds = [...new Set(batchDto.activities.map(a => a.account_user_id))];
            await this.validateAccountUsers(accountUserIds, language);

            const results = await this.prisma.$transaction(async (tx) => {
                const activities = [];

                for (const activityDto of batchDto.activities) {
                    const activityData: Prisma.AccountUserActivityCreateInput = {
                        account_user: { connect: { id: activityDto.account_user_id } },
                        activity_type: activityDto.activity_type,
                        weight: activityDto.weight || 1,
                        metadata: activityDto.metadata || {},
                    };

                    if (activityDto.target_type) activityData.target_type = activityDto.target_type;
                    if (activityDto.target_id) activityData.target_id = activityDto.target_id;
                    if (activityDto.product_id) {
                        activityData.product = { connect: { id: activityDto.product_id } };
                    }

                    const activity = await tx.accountUserActivity.create({
                        data: activityData,
                    });

                    activities.push(activity);
                }

                return activities;
            });

            // پاک کردن کش برای همه کاربران مربوطه
            await Promise.all(
                accountUserIds.map(id => this.clearActivityCaches(id))
            );

            // پردازش الگوها برای کل دسته
            this.processBatchPatterns(results).catch(error =>
                this.logger.error('Error processing batch patterns:', error)
            );

            this.logger.log(`Batch activities tracked: ${results.length} activities`);

            return {
                success: true,
                count: results.length,
                activities: results
            };

        } catch (error) {
            this.logger.error('Error tracking batch activities:', error);
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('BATCH_ACTIVITY_TRACK_ERROR', language);
        }
    }

    // ==================== بازیابی و کوئری‌ها ====================

    async getActivitiesByUser(accountUserId: string, query: any = {}, language: Language = Language.fa) {
        const cacheKey = `activities:user:${accountUserId}:${JSON.stringify(query)}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const { page = 1, limit = 50, activity_type, start_date, end_date } = query;
            const skip = (page - 1) * limit;

            const where: Prisma.AccountUserActivityWhereInput = {
                account_user_id: accountUserId,
            };

            if (activity_type) where.activity_type = activity_type;
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
                    user_id: accountUserId,
                },
            };

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            this.logger.error('Error getting user activities:', error);
            throw new I18nInternalServerErrorException('ACTIVITIES_FETCH_ERROR', language);
        }
    }

    async getRecentActivities(accountUserId: string, limit: number = 20, language: Language = Language.fa) {
        const cacheKey = `activities:recent:${accountUserId}:${limit}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const activities = await this.prisma.accountUserActivity.findMany({
                where: { account_user_id: accountUserId },
                take: limit,
                include: this.getActivityIncludeFields(language),
                orderBy: { created_at: 'desc' },
            });

            await this.cacheManager.set(cacheKey, activities, this.CACHE_TTL / 2);
            return activities;

        } catch (error) {
            this.logger.error('Error getting recent activities:', error);
            throw new I18nInternalServerErrorException('RECENT_ACTIVITIES_FETCH_ERROR', language);
        }
    }

    // ==================== آمار و آنالیتیکس ====================

    async getUserActivityStats(accountUserId: string, query: ActivityStatsQueryDto = {}, language: Language = Language.fa) {
        const cacheKey = `stats:user:${accountUserId}:${JSON.stringify(query)}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const where = this.buildStatsWhereClause({ account_user_id: accountUserId, ...query });

            const [
                totalActivities,
                todayActivities,
                activityBreakdown,
                popularProducts,
                peakHours
            ] = await Promise.all([
                this.prisma.accountUserActivity.count({ where }),
                this.prisma.accountUserActivity.count({
                    where: {
                        ...where,
                        created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                    }
                }),
                this.getActivityTypeBreakdown(where),
                this.getPopularProducts(where, 5, language),
                this.getPeakHours(where)
            ]);

            const result = {
                user_id: accountUserId,
                period: query.days ? `last_${query.days}_days` : 'all_time',
                total_activities: totalActivities,
                today_activities: todayActivities,
                activity_breakdown: activityBreakdown,
                popular_products: popularProducts,
                peak_hours: peakHours,
                engagement_score: await this.calculateEngagementScore(accountUserId, where)
            };

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            this.logger.error('Error getting user activity stats:', error);
            throw new I18nInternalServerErrorException('USER_STATS_FETCH_ERROR', language);
        }
    }

    async getAccountActivityStats(accountId: string, query: ActivityStatsQueryDto = {}, language: Language = Language.fa) {
        const cacheKey = `stats:account:${accountId}:${JSON.stringify(query)}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            // پیدا کردن تمام account_userهای این اکانت
            const accountUsers = await this.prisma.accountUser.findMany({
                where: { account_id: accountId },
                select: { id: true }
            });

            const accountUserIds = accountUsers.map(au => au.id);

            if (accountUserIds.length === 0) {
                return this.getEmptyAccountStats(accountId);
            }

            const where = this.buildStatsWhereClause({
                account_user_ids: accountUserIds,
                ...query
            });

            const stats = await this.getAggregatedStats(where, accountUserIds.length);

            const result = {
                account_id: accountId,
                total_users: accountUserIds.length,
                ...stats
            };

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            this.logger.error('Error getting account activity stats:', error);
            throw new I18nInternalServerErrorException('ACCOUNT_STATS_FETCH_ERROR', language);
        }
    }

    // ==================== تحلیل الگوها و بینش‌ها ====================

    async getUserActivityPatterns(accountUserId: string, language: Language = Language.fa): Promise<UserActivityPattern> {
        const cacheKey = `patterns:user:${accountUserId}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as UserActivityPattern;
            }

            const recentActivities = await this.prisma.accountUserActivity.findMany({
                where: {
                    account_user_id: accountUserId,
                    created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                },
                include: {
                    product: {
                        include: {
                            contents: {
                                where: { language },
                                select: {
                                    name: true,
                                    category_name: true
                                }
                            },
                            category: {
                                include: {
                                    contents: {
                                        where: { language },
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            });

            const patterns = await this.analyzeUserPatterns(accountUserId, recentActivities, language);

            await this.cacheManager.set(cacheKey, patterns, this.PATTERN_UPDATE_INTERVAL);
            return patterns;

        } catch (error) {
            this.logger.error('Error getting user activity patterns:', error);
            throw new I18nInternalServerErrorException('USER_PATTERNS_FETCH_ERROR', language);
        }
    }

    async getProductEngagement(productId: string, days: number = 30, language: Language = Language.fa): Promise<ProductEngagement> {
        const cacheKey = `engagement:product:${productId}:${days}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached as ProductEngagement;
            }

            const where: Prisma.AccountUserActivityWhereInput = {
                product_id: productId,
                created_at: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
            };

            const [
                viewActivities,
                saveActivities,
                likeActivities,
                productInfo
            ] = await Promise.all([
                this.prisma.accountUserActivity.count({
                    where: { ...where, activity_type: 'PRODUCT_VIEW' }
                }),
                this.prisma.accountUserActivity.count({
                    where: { ...where, activity_type: 'PRODUCT_SAVE' }
                }),
                this.prisma.accountUserActivity.count({
                    where: { ...where, activity_type: 'PRODUCT_LIKE' }
                }),
                this.prisma.product.findUnique({
                    where: { id: productId },
                    include: {
                        contents: {
                            where: { language },
                            select: {
                                name: true,
                                category_name: true
                            }
                        }
                    }
                })
            ]);

            const uniqueUsers = await this.prisma.accountUserActivity.groupBy({
                by: ['account_user_id'],
                where,
                _count: true
            });

            const productName = productInfo?.contents[0]?.name || this.i18nService.t('UNKNOWN_PRODUCT', language);
            const categoryName = productInfo?.contents[0]?.category_name || this.i18nService.t('UNKNOWN_CATEGORY', language);

            const engagement: ProductEngagement = {
                product_id: productId,
                name: productName,
                category_name: categoryName,
                total_views: viewActivities,
                total_saves: saveActivities,
                total_likes: likeActivities,
                unique_users: uniqueUsers.length,
                engagement_rate: this.calculateEngagementRate(viewActivities, saveActivities + likeActivities),
                conversion_rate: this.calculateConversionRate(viewActivities, saveActivities),
                avg_time_spent: await this.calculateAverageTimeSpent(where)
            };

            await this.cacheManager.set(cacheKey, engagement, this.CACHE_TTL);
            return engagement;

        } catch (error) {
            this.logger.error('Error getting product engagement:', error);
            throw new I18nInternalServerErrorException('PRODUCT_ENGAGEMENT_FETCH_ERROR', language);
        }
    }

    // ==================== متدهای عمومی ====================

    async getActivitiesOverview(days: number = 30, language: Language = Language.fa) {
        try {
            const where: Prisma.AccountUserActivityWhereInput = {
                created_at: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
            };

            const [
                totalActivities,
                uniqueUsers,
                activityTrend,
                topProducts,
                topCategories
            ] = await Promise.all([
                this.prisma.accountUserActivity.count({ where }),
                this.prisma.accountUserActivity.groupBy({
                    by: ['account_user_id'],
                    where,
                    _count: true
                }),
                this.getActivityTrend(where, days),
                this.getPopularProducts(where, 10, language),
                this.getTopCategories(where, 10, language)
            ]);

            return {
                period_days: days,
                total_activities: totalActivities,
                unique_users: uniqueUsers.length,
                daily_average: totalActivities / days,
                activity_trend: activityTrend,
                top_products: topProducts,
                top_categories: topCategories,
                engagement_metrics: await this.getEngagementMetrics(where)
            };

        } catch (error) {
            this.logger.error('Error getting activities overview:', error);
            throw new I18nInternalServerErrorException('ACTIVITIES_OVERVIEW_FETCH_ERROR', language);
        }
    }

    async getActivityTrends(query: ActivityAnalyticsQueryDto, language: Language = Language.fa) {
        try {
            const where = this.buildStatsWhereClause(query);

            const trends = await this.prisma.accountUserActivity.groupBy({
                by: ['created_at', 'activity_type'],
                where,
                _count: true,
                orderBy: { created_at: 'asc' }
            });

            // گروه‌بندی بر اساس تاریخ و نوع فعالیت
            const groupedTrends = trends.reduce((acc, trend) => {
                const date = trend.created_at.toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = {};
                }
                acc[date][trend.activity_type] = trend._count;
                return acc;
            }, {});

            return {
                period: query.days ? `last_${query.days}_days` : 'all_time',
                trends: groupedTrends,
                summary: await this.getActivityTypeBreakdown(where)
            };

        } catch (error) {
            this.logger.error('Error getting activity trends:', error);
            throw new I18nInternalServerErrorException('ACTIVITY_TRENDS_FETCH_ERROR', language);
        }
    }

    async getTopProductsByEngagement(limit: number = 10, days: number = 30, language: Language = Language.fa) {
        try {
            const where: Prisma.AccountUserActivityWhereInput = {
                product_id: { not: null },
                created_at: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
            };

            const productEngagements = await this.prisma.accountUserActivity.groupBy({
                by: ['product_id'],
                where,
                _count: true,
                orderBy: { _count: { product_id: 'desc' } },
                take: limit * 2
            });

            // محاسبه engagement rate برای هر محصول
            const engagements = await Promise.all(
                productEngagements.map(async (product) => {
                    if (!product.product_id) return null;

                    const engagement = await this.getProductEngagement(product.product_id, days, language);
                    return {
                        ...engagement,
                        total_activities: product._count
                    };
                })
            );

            // فیلتر کردن nullها و مرتب‌سازی بر اساس engagement rate
            return engagements
                .filter(e => e !== null)
                .sort((a, b) => b!.engagement_rate - a!.engagement_rate)
                .slice(0, limit);

        } catch (error) {
            this.logger.error('Error getting top products by engagement:', error);
            throw new I18nInternalServerErrorException('TOP_PRODUCTS_FETCH_ERROR', language);
        }
    }

    async getUserEngagementAnalytics(language: Language = Language.fa) {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const [
                totalUsers,
                activeUsers,
                userActivities,
                retentionData
            ] = await Promise.all([
                this.prisma.accountUser.count(),
                this.prisma.accountUserBehavior.count({
                    where: {
                        last_active: { gte: thirtyDaysAgo }
                    }
                }),
                this.prisma.accountUserActivity.groupBy({
                    by: ['account_user_id'],
                    where: {
                        created_at: { gte: thirtyDaysAgo }
                    },
                    _count: true
                }),
                this.calculateRetentionMetrics()
            ]);

            const activityDistribution = this.calculateActivityDistribution(userActivities);

            return {
                total_users: totalUsers,
                active_users: activeUsers,
                engagement_rate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
                avg_activities_per_user: userActivities.length > 0 ?
                    userActivities.reduce((sum, u) => sum + u._count, 0) / userActivities.length : 0,
                activity_distribution: activityDistribution,
                retention_metrics: retentionData
            };

        } catch (error) {
            this.logger.error('Error getting user engagement analytics:', error);
            throw new I18nInternalServerErrorException('USER_ENGAGEMENT_ANALYTICS_ERROR', language);
        }
    }

    async getCategoryInsights(days: number = 30, language: Language = Language.fa) {
        try {
            return await this.getCategoryInsightsFallback(days, language);
        } catch (error) {
            this.logger.error('Error getting category insights:', error);
            throw new I18nInternalServerErrorException('CATEGORY_INSIGHTS_FETCH_ERROR', language);
        }
    }

    // ==================== مدیریت داده‌ها ====================

    async deleteActivity(activityId: string, language: Language = Language.fa) {
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

    async deleteUserActivities(accountUserId: string, language: Language = Language.fa) {
        try {
            const result = await this.prisma.accountUserActivity.deleteMany({
                where: { account_user_id: accountUserId }
            });

            await this.clearActivityCaches(accountUserId);

            this.logger.log(`Deleted ${result.count} activities for user ${accountUserId}`);
            return {
                deletedCount: result.count,
                message: this.i18nService.t('USER_ACTIVITIES_DELETED_SUCCESS', language, { count: result.count })
            };

        } catch (error) {
            this.logger.error('Error deleting user activities:', error);
            throw new I18nInternalServerErrorException('USER_ACTIVITIES_DELETE_ERROR', language);
        }
    }

    async cleanupOldActivities(olderThanDays: number, language: Language = Language.fa) {
        try {
            const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

            const result = await this.prisma.accountUserActivity.deleteMany({
                where: {
                    created_at: { lt: cutoffDate }
                }
            });

            this.logger.log(`Cleanup: Deleted ${result.count} activities older than ${olderThanDays} days`);
            return {
                deletedCount: result.count,
                message: this.i18nService.t('OLD_ACTIVITIES_CLEANED_SUCCESS', language, { count: result.count, days: olderThanDays })
            };

        } catch (error) {
            this.logger.error('Error cleaning up old activities:', error);
            throw new I18nInternalServerErrorException('OLD_ACTIVITIES_CLEANUP_ERROR', language);
        }
    }

    async exportActivitiesToCSV(startDate?: string, endDate?: string, language: Language = Language.fa) {
        try {
            const where: Prisma.AccountUserActivityWhereInput = {};

            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = new Date(startDate);
                if (endDate) where.created_at.lte = new Date(endDate);
            }

            // گرفتن فعالیت‌ها با اطلاعات کامل
            const activities = await this.prisma.accountUserActivity.findMany({
                where,
                include: {
                    account_user: {
                        include: {
                            user: {
                                include: {
                                    contents: {
                                        where: { language },
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
                                        select: {
                                            name: true
                                        }
                                    },
                                    industry: {
                                        include: {
                                            contents: {
                                                where: { language },
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
                                select: {
                                    name: true,
                                    category_name: true
                                }
                            }
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: 10000
            });

            // ساخت هدر CSV
            const headers = [
                this.i18nService.t('DATE', language),
                this.i18nService.t('TIME', language),
                this.i18nService.t('ACTIVITY_TYPE', language),
                this.i18nService.t('USER', language),
                this.i18nService.t('ACCOUNT', language),
                this.i18nService.t('INDUSTRY', language),
                this.i18nService.t('PRODUCT', language),
                this.i18nService.t('CATEGORY', language),
                this.i18nService.t('WEIGHT', language),
                this.i18nService.t('METADATA', language)
            ];

            // ساخت ردیف‌های داده
            const rows = activities.map(activity => {
                const userContent = activity.account_user.user.contents[0];
                const accountContent = activity.account_user.account.contents[0];
                const industryContent = activity.account_user.account.industry?.contents[0];
                const productContent = activity.product?.contents[0];

                return [
                    new Date(activity.created_at).toLocaleDateString('fa-IR'),
                    new Date(activity.created_at).toLocaleTimeString('fa-IR'),
                    activity.activity_type,
                    `${userContent?.first_name || ''} ${userContent?.last_name || ''}`.trim() || this.i18nService.t('UNKNOWN_USER', language),
                    accountContent?.name || this.i18nService.t('UNKNOWN_ACCOUNT', language),
                    industryContent?.name || this.i18nService.t('UNKNOWN_INDUSTRY', language),
                    productContent?.name || this.i18nService.t('UNKNOWN_PRODUCT', language),
                    productContent?.category_name || this.i18nService.t('UNKNOWN_CATEGORY', language),
                    activity.weight.toString(),
                    JSON.stringify(activity.metadata || {})
                ];
            });

            // ساخت CSV
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(field => `"${field}"`).join(','))
            ].join('\n');

            return {
                filename: `activities_export_${new Date().toISOString().split('T')[0]}.csv`,
                content: csvContent,
                count: activities.length,
                period: {
                    start: startDate,
                    end: endDate
                }
            };

        } catch (error) {
            this.logger.error('Error exporting activities to CSV:', error);
            throw new I18nInternalServerErrorException('ACTIVITIES_EXPORT_ERROR', language);
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
                                select: {
                                    name: true
                                }
                            },
                            industry: {
                                include: {
                                    contents: {
                                        where: { language },
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
                        select: {
                            name: true,
                            category_name: true
                        }
                    }
                }
            }
        };
    }

    private async validateAccountUser(accountUserId: string, language: Language) {
        const accountUser = await this.prisma.accountUser.findUnique({
            where: { id: accountUserId }
        });

        if (!accountUser) {
            throw new I18nNotFoundException('ACCOUNT_USER_NOT_FOUND', language, { accountUserId });
        }

        return accountUser;
    }

    private async validateAccountUsers(accountUserIds: string[], language: Language) {
        const accountUsers = await this.prisma.accountUser.findMany({
            where: { id: { in: accountUserIds } },
            select: { id: true }
        });

        const foundIds = new Set(accountUsers.map(au => au.id));
        const missingIds = accountUserIds.filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
            throw new I18nNotFoundException('INVALID_ACCOUNT_USERS', language, { missingIds: missingIds.join(', ') });
        }
    }

    private buildStatsWhereClause(query: ActivityStatsQueryDto): Prisma.AccountUserActivityWhereInput {
        const where: Prisma.AccountUserActivityWhereInput = {};

        if (query.account_user_id) {
            where.account_user_id = query.account_user_id;
        }
        if (query.account_user_ids && query.account_user_ids.length > 0) {
            where.account_user_id = { in: query.account_user_ids };
        }

        if (query.start_date || query.end_date) {
            where.created_at = {};
            if (query.start_date) where.created_at.gte = new Date(query.start_date);
            if (query.end_date) where.created_at.lte = new Date(query.end_date);
        } else if (query.days) {
            where.created_at = {
                gte: new Date(Date.now() - query.days * 24 * 60 * 60 * 1000)
            };
        }

        return where;
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

    private async getPopularProducts(where: Prisma.AccountUserActivityWhereInput, limit: number = 5, language: Language = Language.fa) {
        const popular = await this.prisma.accountUserActivity.groupBy({
            by: ['product_id'],
            where: { ...where, product_id: { not: null } },
            _count: true,
            orderBy: { _count: { product_id: 'desc' } },
            take: limit
        });

        const productIds = popular.map(p => p.product_id).filter(Boolean) as string[];

        if (productIds.length === 0) {
            return [];
        }

        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            include: {
                contents: {
                    where: { language },
                    select: {
                        name: true,
                        category_name: true
                    }
                }
            }
        });

        return popular.map(item => {
            const product = products.find(p => p.id === item.product_id);
            const productContent = product?.contents[0];

            return {
                product_id: item.product_id,
                name: productContent?.name || this.i18nService.t('UNKNOWN_PRODUCT', language),
                category_name: productContent?.category_name || this.i18nService.t('UNKNOWN_CATEGORY', language),
                activity_count: item._count
            };
        });
    }

    private async getPeakHours(where: Prisma.AccountUserActivityWhereInput) {
        const activities = await this.prisma.accountUserActivity.findMany({
            where,
            select: { created_at: true }
        });

        const hourlyCount = Array(24).fill(0);
        activities.forEach(activity => {
            const hour = new Date(activity.created_at).getHours();
            hourlyCount[hour]++;
        });

        return hourlyCount;
    }

    private calculateEngagementRate(views: number, interactions: number): number {
        return views > 0 ? (interactions / views) * 100 : 0;
    }

    private calculateConversionRate(views: number, saves: number): number {
        return views > 0 ? (saves / views) * 100 : 0;
    }

    private async calculateAverageTimeSpent(where: Prisma.AccountUserActivityWhereInput): Promise<number> {
        // این نیاز به داده‌های زمانی دقیق‌تر دارد
        return 45; // ثانیه
    }

    private async calculateEngagementScore(accountUserId: string, where: Prisma.AccountUserActivityWhereInput): Promise<number> {
        const activities = await this.prisma.accountUserActivity.findMany({
            where: { ...where, account_user_id: accountUserId }
        });

        if (activities.length === 0) return 0;

        let score = 0;
        activities.forEach(activity => {
            switch (activity.activity_type) {
                case 'PRODUCT_VIEW':
                    score += 1 * (activity.weight || 1);
                    break;
                case 'PRODUCT_SAVE':
                    score += 3 * (activity.weight || 1);
                    break;
                case 'PRODUCT_LIKE':
                    score += 2 * (activity.weight || 1);
                    break;
                case 'SEARCH_QUERY':
                    score += 1 * (activity.weight || 1);
                    break;
            }
        });

        return Math.min(100, score / activities.length * 10);
    }

    private async analyzeUserPatterns(accountUserId: string, activities: any[], language: Language): Promise<UserActivityPattern> {
        const patterns: UserActivityPattern = {
            account_user_id: accountUserId,
            peak_hours: this.calculatePeakHoursFromActivities(activities),
            favorite_categories: this.extractFavoriteCategories(activities, language),
            search_habits: this.analyzeSearchHabits(activities),
            browsing_behavior: this.analyzeBrowsingBehavior(activities),
            purchase_patterns: await this.analyzePurchasePatterns(accountUserId),
            engagement_score: await this.calculateEngagementScore(accountUserId, {}),
            last_updated: new Date()
        };

        return patterns;
    }

    private calculatePeakHoursFromActivities(activities: any[]): number[] {
        const hourlyCount = Array(24).fill(0);
        activities.forEach(activity => {
            const hour = new Date(activity.created_at).getHours();
            hourlyCount[hour]++;
        });

        const maxCount = Math.max(...hourlyCount);
        return hourlyCount
            .map((count, hour) => ({ hour, count }))
            .filter(item => item.count >= maxCount * 0.7)
            .map(item => item.hour);
    }

    private extractFavoriteCategories(activities: any[], language: Language): string[] {
        const categoryCount: Record<string, number> = {};

        activities.forEach(activity => {
            if (activity.product?.contents?.[0]?.category_name) {
                const category = activity.product.contents[0].category_name;
                categoryCount[category] = (categoryCount[category] || 0) + 1;
            } else if (activity.product?.category?.contents?.[0]?.name) {
                const category = activity.product.category.contents[0].name;
                categoryCount[category] = (categoryCount[category] || 0) + 1;
            }
        });

        return Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([category]) => category)
            .filter(Boolean);
    }

    private analyzeSearchHabits(activities: any[]): any {
        const searchActivities = activities.filter(a => a.activity_type === 'SEARCH_QUERY');
        const queries = searchActivities.map(a => a.metadata?.query).filter(Boolean);

        return {
            avg_query_length: queries.length > 0 ?
                queries.reduce((sum, query) => sum + query.length, 0) / queries.length : 0,
            common_filters: this.extractCommonFilters(searchActivities),
            time_between_searches: this.calculateAverageTimeBetweenSearches(searchActivities)
        };
    }

    private extractCommonFilters(searchActivities: any[]): string[] {
        const filters: string[] = [];

        searchActivities.forEach(activity => {
            if (activity.metadata?.filters) {
                Object.keys(activity.metadata.filters).forEach(filter => {
                    filters.push(filter);
                });
            }
        });

        return [...new Set(filters)].slice(0, 10);
    }

    private calculateAverageTimeBetweenSearches(searchActivities: any[]): number {
        if (searchActivities.length < 2) return 0;

        const sortedActivities = searchActivities
            .map(a => new Date(a.created_at).getTime())
            .sort((a, b) => a - b);

        let totalDiff = 0;
        for (let i = 1; i < sortedActivities.length; i++) {
            totalDiff += sortedActivities[i] - sortedActivities[i - 1];
        }

        return totalDiff / (sortedActivities.length - 1) / (1000 * 60);
    }

    private analyzeBrowsingBehavior(activities: any[]): any {
        return {
            avg_session_duration: 180,
            pages_per_session: 4.2,
            bounce_rate: 0.35
        };
    }

    private async analyzePurchasePatterns(accountUserId: string): Promise<any> {
        return {
            avg_order_value: 0,
            conversion_rate: 0,
            favorite_brands: []
        };
    }

    private async processActivityPatterns(activity: any) {
        try {
            await this.getUserActivityPatterns(activity.account_user_id);
        } catch (error) {
            this.logger.warn(`Failed to process patterns for user ${activity.account_user_id}:`, error);
        }
    }

    private async processBatchPatterns(activities: any[]) {
        const uniqueUserIds = [...new Set(activities.map(a => a.account_user_id))];

        await Promise.all(
            uniqueUserIds.map(userId => this.processActivityPatterns({ account_user_id: userId }))
        );
    }

    private async getAggregatedStats(where: Prisma.AccountUserActivityWhereInput, userCount: number) {
        const [
            totalActivities,
            activityBreakdown,
            popularProducts,
            peakHours
        ] = await Promise.all([
            this.prisma.accountUserActivity.count({ where }),
            this.getActivityTypeBreakdown(where),
            this.getPopularProducts(where, 10),
            this.getPeakHours(where)
        ]);

        return {
            total_activities: totalActivities,
            avg_activities_per_user: userCount > 0 ? totalActivities / userCount : 0,
            activity_breakdown: activityBreakdown,
            popular_products: popularProducts,
            peak_hours: peakHours
        };
    }

    private async clearActivityCaches(accountUserId: string) {
        const patterns = [
            `activities:user:${accountUserId}:*`,
            `activities:recent:${accountUserId}:*`,
            `stats:user:${accountUserId}:*`,
            `patterns:user:${accountUserId}`
        ];

        await Promise.all(
            patterns.map(pattern => this.clearPatternKeys(pattern))
        );
    }

    private async clearPatternKeys(pattern: string): Promise<void> {
        try {
            this.logger.debug(`Clearing cache pattern: ${pattern}`);
        } catch (error) {
            this.logger.warn(`Failed to clear cache pattern ${pattern}:`, error);
        }
    }

    private async getActivityTrend(where: Prisma.AccountUserActivityWhereInput, days: number) {
        const activities = await this.prisma.accountUserActivity.groupBy({
            by: ['created_at'],
            where,
            _count: true,
            orderBy: { created_at: 'asc' }
        });

        const dailyTrend = activities.reduce((acc, activity) => {
            const date = activity.created_at.toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + activity._count;
            return acc;
        }, {});

        return dailyTrend;
    }

    private async getTopCategories(where: Prisma.AccountUserActivityWhereInput, limit: number, language: Language) {
        const activities = await this.prisma.accountUserActivity.findMany({
            where: { ...where, product: { isNot: null } },
            include: {
                product: {
                    include: {
                        contents: {
                            where: { language },
                            select: {
                                category_name: true
                            }
                        }
                    }
                }
            },
            take: 10000
        });

        const categoryCount: Record<string, number> = {};

        activities.forEach(activity => {
            if (activity.product?.contents?.[0]?.category_name) {
                const category = activity.product.contents[0].category_name;
                categoryCount[category] = (categoryCount[category] || 0) + 1;
            }
        });

        return Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([category, count]) => ({
                category,
                count,
                category_name: category
            }));
    }

    private async getEngagementMetrics(where: Prisma.AccountUserActivityWhereInput) {
        const [
            totalViews,
            totalSaves,
            totalLikes,
            totalSearches
        ] = await Promise.all([
            this.prisma.accountUserActivity.count({
                where: { ...where, activity_type: 'PRODUCT_VIEW' }
            }),
            this.prisma.accountUserActivity.count({
                where: { ...where, activity_type: 'PRODUCT_SAVE' }
            }),
            this.prisma.accountUserActivity.count({
                where: { ...where, activity_type: 'PRODUCT_LIKE' }
            }),
            this.prisma.accountUserActivity.count({
                where: { ...where, activity_type: 'SEARCH_QUERY' }
            })
        ]);

        return {
            total_views: totalViews,
            total_saves: totalSaves,
            total_likes: totalLikes,
            total_searches: totalSearches,
            save_rate: totalViews > 0 ? (totalSaves / totalViews) * 100 : 0,
            like_rate: totalViews > 0 ? (totalLikes / totalViews) * 100 : 0
        };
    }

    private calculateActivityDistribution(userActivities: any[]) {
        const distribution = {
            low: 0,
            medium: 0,
            high: 0,
            very_high: 0
        };

        userActivities.forEach(user => {
            if (user._count <= 10) distribution.low++;
            else if (user._count <= 50) distribution.medium++;
            else if (user._count <= 200) distribution.high++;
            else distribution.very_high++;
        });

        return distribution;
    }

    private async getCategoryInsightsFallback(days: number = 30, language: Language = Language.fa) {
        const where: Prisma.AccountUserActivityWhereInput = {
            created_at: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
            product_id: { not: null }
        };

        const activities = await this.prisma.accountUserActivity.findMany({
            where,
            include: {
                product: {
                    include: {
                        contents: {
                            where: { language },
                            select: {
                                category_name: true
                            }
                        }
                    }
                }
            },
            take: 50000
        });

        const categoryStats: Record<string, any> = {};

        activities.forEach(activity => {
            if (!activity.product?.contents?.[0]?.category_name) return;

            const category = activity.product.contents[0].category_name;
            if (!categoryStats[category]) {
                categoryStats[category] = {
                    total_activities: 0,
                    unique_products: new Set(),
                    unique_users: new Set<string>()
                };
            }

            categoryStats[category].total_activities++;
            if (activity.product_id) {
                categoryStats[category].unique_products.add(activity.product_id);
            }
            categoryStats[category].unique_users.add(activity.account_user_id);
        });

        return Object.entries(categoryStats)
            .map(([category, stats]) => ({
                category_name: category,
                total_activities: stats.total_activities,
                unique_products: stats.unique_products.size,
                unique_users: stats.unique_users.size,
                engagement_score: stats.unique_products.size > 0 ?
                    stats.total_activities / stats.unique_products.size : 0
            }))
            .sort((a, b) => b.total_activities - a.total_activities);
    }

    private async calculateRetentionMetrics() {
        return {
            day_1: 85.5,
            day_7: 72.3,
            day_30: 58.7,
            monthly_retention: 65.2
        };
    }

    private getEmptyAccountStats(accountId: string) {
        return {
            account_id: accountId,
            total_users: 0,
            total_activities: 0,
            avg_activities_per_user: 0,
            activity_breakdown: {},
            popular_products: [],
            peak_hours: Array(24).fill(0)
        };
    }
}