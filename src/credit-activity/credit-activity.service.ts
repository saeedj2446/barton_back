// src/credit-activity/credit-activity.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { CreditTransactionQueryDto } from '../credit-transaction/dto/credit-transaction-query.dto';
import { CreditActivityStatus, CreditActivityType, Language } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from "../prisma/prisma.service";
import { UpdateCreditActivityDto } from "./dto/update-credit-activity.dto";
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nInternalServerErrorException
} from '../common/exceptions/i18n-exceptions';
import {CreateCreditActivityDto} from "./dto/credit-activity.dto";

// تعریف نوع برای قیمت‌های فعالیت
interface ActivityPriceConfig {
    base_price: number;
    price_type: 'FIXED' | 'PER_UNIT';
    unit_name?: string;
    description: string;
}

interface ActivityPrices {
    [key: string]: ActivityPriceConfig;
}

@Injectable()
export class CreditActivityService {
    private readonly logger = new Logger(CreditActivityService.name);
    private readonly DEFAULT_LANGUAGE = Language.fa;

    private readonly activity_prices: ActivityPrices = {
        "PRODUCT_BOOST": {
            "base_price": 30000,
            "price_type": "FIXED",
            "description": "نردبان کردن محصول"
        },
        "SEND_BROADCAST": {
            "base_price": 5000,
            "price_type": "PER_UNIT",
            "unit_name": "پیام",
            "description": "ارسال پیام انبوه"
        },
        "FEATURED_BANNER": {
            "base_price": 100000,
            "price_type": "FIXED",
            "description": "بنر ویژه در صفحه اول"
        },
        "VIDEO_UPLOAD": {
            "base_price": 15000,
            "price_type": "FIXED",
            "description": "آپلود ویدئو برای محصول"
        },
        "INVITE_BONUS": {
            "base_price": 50000,
            "price_type": "FIXED",
            "description": "پاداش دعوت از دوستان"
        }
    };

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    // ایجاد فعالیت اعتباری جدید
    async create(createDto: CreateCreditActivityDto, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            // بررسی وجود تراکنش اعتباری
            const transaction = await this.prisma.creditTransaction.findUnique({
                where: { id: createDto.credit_transaction_id }
            });

            if (!transaction) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            // محاسبه هزینه بر اساس نوع فعالیت
            const calculatedCost = await this.calculateActivityCost(
                createDto.activity_type as CreditActivityType,
                createDto.credit_amount
            );

            // ساخت data object با نوع صحیح
            const activityData: any = {
                user_id: createDto.user_id,
                credit_transaction_id: createDto.credit_transaction_id,
                activity_type: createDto.activity_type,
                quantity: createDto.credit_amount,
                unit_price: calculatedCost,
                total_cost: calculatedCost * (createDto.credit_amount || 1),
                status: createDto.status || CreditActivityStatus.PENDING,
            };

            // افزودن فیلدهای اختیاری
            if (createDto.description) activityData.description = createDto.description;
            if (createDto.product_id) activityData.product_id = createDto.product_id;
            if (createDto.account_id) activityData.account_id = createDto.account_id;
            if (createDto.order_id) activityData.order_id = createDto.order_id;
            if (createDto.buy_ad_id) activityData.buy_ad_id = createDto.buy_ad_id;

            const activity = await this.prisma.creditActivity.create({
                data: activityData,
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
                    credit_transaction: true,
                    product: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1,
                                select: {
                                    name: true
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
                            }
                        }
                    }
                }
            });

            // پاک کردن کش مربوطه
            await this.clearUserActivitiesCache(createDto.user_id);

            this.logger.log(`Credit activity created: ${createDto.activity_type} for user ${createDto.user_id}`);
            return activity;

        } catch (error) {
            this.logger.error('Error creating credit activity:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // دریافت فعالیت‌های یک کاربر
    async findByUser(user_id: string, query: CreditTransactionQueryDto = {}, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `user_activities:${user_id}:${JSON.stringify(query)}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const { page = 1, limit = 10, activity_type, startDate, endDate } = query;
            const skip = (page - 1) * limit;

            const where: any = { user_id: user_id };

            if (activity_type) {
                where.activity_type = activity_type;
            }

            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = new Date(startDate);
                if (endDate) where.created_at.lte = new Date(endDate);
            }

            const [activities, total] = await Promise.all([
                this.prisma.creditActivity.findMany({
                    where,
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
                        credit_transaction: true,
                        product: {
                            include: {
                                contents: {
                                    where: { language },
                                    take: 1,
                                    select: {
                                        name: true
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
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.creditActivity.count({ where }),
            ]);

            const result = {
                data: activities,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };

            await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
            return result;

        } catch (error) {
            this.logger.error('Error getting user activities:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // دریافت یک فعالیت خاص
    async findOne(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const activity = await this.prisma.creditActivity.findUnique({
                where: { id },
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
                    credit_transaction: true,
                    product: {
                        include: {
                            contents: {
                                where: { language },
                                take: 1,
                                select: {
                                    name: true
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
                            }
                        }
                    },
                    order: {
                        select: {
                            id: true,
                            order_number: true
                        }
                    },
                    buy_ad: {
                        select: {
                            id: true,
                            // name field might not exist in BuyAd model
                        }
                    }
                }
            });

            if (!activity) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            return activity;

        } catch (error) {
            this.logger.error('Error getting activity:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // بروزرسانی فعالیت
    async update(id: string, updateDto: UpdateCreditActivityDto, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const activity = await this.prisma.creditActivity.findUnique({
                where: { id }
            });

            if (!activity) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            const updatedActivity = await this.prisma.creditActivity.update({
                where: { id },
                data: updateDto,
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
                    }
                }
            });

            await this.clearUserActivitiesCache(activity.user_id);

            this.logger.log(`Credit activity updated: ${id}`);
            return updatedActivity;

        } catch (error) {
            this.logger.error('Error updating activity:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // بروزرسانی وضعیت فعالیت
    async updateStatus(id: string, status: CreditActivityStatus, description?: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const activity = await this.prisma.creditActivity.findUnique({
                where: { id }
            });

            if (!activity) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            const updateData: any = { status };

            if (description) {
                updateData.description = description;
            }

            const updatedActivity = await this.prisma.creditActivity.update({
                where: { id },
                data: updateData,
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
                    }
                }
            });

            await this.clearUserActivitiesCache(activity.user_id);

            this.logger.log(`Credit activity status updated: ${id} to ${status}`);
            return updatedActivity;

        } catch (error) {
            this.logger.error('Error updating activity status:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // حذف فعالیت
    async remove(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const activity = await this.prisma.creditActivity.findUnique({
                where: { id }
            });

            if (!activity) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            await this.prisma.creditActivity.delete({
                where: { id }
            });

            await this.clearUserActivitiesCache(activity.user_id);

            this.logger.log(`Credit activity deleted: ${id}`);
            return {
                message: this.i18nService.t('ACTIVITY_DELETED_SUCCESS', language)
            };

        } catch (error) {
            this.logger.error('Error deleting activity:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // ==================== سرویس‌های ادمین ====================

    // جستجو در تمام فعالیت‌ها
    async findAllAdmin(query: CreditTransactionQueryDto, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `admin_activities:${JSON.stringify(query)}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const { page = 1, limit = 10, user_id, activity_type, startDate, endDate } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (user_id) {
                where.user_id = user_id;
            }

            if (activity_type) {
                where.activity_type = activity_type;
            }

            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = new Date(startDate);
                if (endDate) where.created_at.lte = new Date(endDate);
            }

            const [activities, total] = await Promise.all([
                this.prisma.creditActivity.findMany({
                    where,
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
                        credit_transaction: true,
                        product: {
                            include: {
                                contents: {
                                    where: { language },
                                    take: 1,
                                    select: {
                                        name: true
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
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.creditActivity.count({ where }),
            ]);

            const result = {
                data: activities,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };

            await this.cacheManager.set(cacheKey, result, 2 * 60 * 1000);
            return result;

        } catch (error) {
            this.logger.error('Error getting admin activities:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // دریافت آمار فعالیت‌ها
    async getActivitiesStats(language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `activities_stats:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const [
                totalActivities,
                todayActivities,
                totalCost,
                activityTypesStats,
                statusStats
            ] = await Promise.all([
                this.prisma.creditActivity.count(),
                this.prisma.creditActivity.count({
                    where: {
                        created_at: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0))
                        }
                    }
                }),
                this.prisma.creditActivity.aggregate({
                    _sum: { total_cost: true }
                }),
                this.prisma.creditActivity.groupBy({
                    by: ['activity_type'],
                    _count: { id: true },
                    _sum: { total_cost: true },
                    where: {
                        created_at: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    }
                }),
                this.prisma.creditActivity.groupBy({
                    by: ['status'],
                    _count: { id: true }
                })
            ]);

            const stats = {
                totalActivities,
                todayActivities,
                totalCost: totalCost._sum.total_cost || 0,
                activityTypes: activityTypesStats.map(stat => ({
                    activity_type: stat.activity_type,
                    count: stat._count.id,
                    totalCost: stat._sum.total_cost
                })),
                statusDistribution: statusStats.map(stat => ({
                    status: stat.status,
                    count: stat._count.id
                }))
            };

            await this.cacheManager.set(cacheKey, stats, 10 * 60 * 1000);
            return stats;

        } catch (error) {
            this.logger.error('Error getting activities stats:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // محاسبه هزینه فعالیت
    private async calculateActivityCost(activity_type: CreditActivityType, creditAmount: number): Promise<number> {
        const priceConfig = this.activity_prices[activity_type];
        if (!priceConfig) {
            return 0;
        }

        if (priceConfig.price_type === 'FIXED') {
            return priceConfig.base_price;
        } else if (priceConfig.price_type === 'PER_UNIT') {
            return priceConfig.base_price * creditAmount;
        }

        return 0;
    }

    // دریافت لیست قیمت‌های فعالیت
    getActivityPrices() {
        return this.activity_prices;
    }

    // پاک کردن کش کاربر
    private async clearUserActivitiesCache(user_id: string): Promise<void> {
        try {
            const keysToDelete = [
                `user_activities:${user_id}:*`,
                `activities_stats:*`
            ];

            await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
        } catch (error) {
            this.logger.warn('Error clearing cache:', error);
        }
    }
}