// src/plan/plan.service.ts
import {
    Injectable,
    Inject,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import {
    OrderType,
    OrderStatus,
    TransactionStatus,
    TransactionType,
    PaymentMethod,
    PlanStatus,
    Language
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nBadRequestException,
    I18nConflictException,
    I18nInternalServerErrorException
} from '../common/exceptions/i18n-exceptions';
import {PurchasePlanDto} from "./dto/urchase-plan.dto";

@Injectable()
export class PlanService {
    private readonly logger = new Logger(PlanService.name);
    private readonly DEFAULT_LANGUAGE = Language.fa;

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    // ==================== مدیریت پلن‌ها ====================

    async createPlan(createPlanDto: CreatePlanDto, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            // بررسی تکراری نبودن سطح
            const existingPlan = await this.prisma.plan.findUnique({
                where: { level: createPlanDto.level }
            });

            if (existingPlan) {
                throw new I18nConflictException('DUPLICATE_ENTRY', language);
            }

            const total_credit = createPlanDto.credit_amount + (createPlanDto.bonus_credit || 0);

            // ایجاد پلن با محتوای چندزبانه
            const plan = await this.prisma.plan.create({
                data: {
                    level: createPlanDto.level,
                    price: createPlanDto.price,
                    credit_amount: createPlanDto.credit_amount,
                    bonus_credit: createPlanDto.bonus_credit || 0,
                    total_credit,
                    expiry_days: createPlanDto.expiry_days,
                    status: PlanStatus.ACTIVE,
                    is_popular: createPlanDto.is_popular || false,
                    contents: {
                        create: {
                            language: language,
                            name: createPlanDto.name,
                            description: createPlanDto.description,
                            benefits: createPlanDto.benefits || [],
                            auto_translated: false
                        }
                    }
                },
                include: {
                    contents: {
                        where: { language },
                        take: 1
                    }
                }
            });

            // پاک کردن کش
            await this.clearPlansCache();

            this.logger.log(`Plan created: ${createPlanDto.name} (Level: ${createPlanDto.level})`);
            return plan;

        } catch (error) {
            this.logger.error('Error creating plan:', error);
            if (error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    async getActivePlans(language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `active_plans:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const plans = await this.prisma.plan.findMany({
                where: { status: PlanStatus.ACTIVE },
                include: {
                    contents: {
                        where: { language },
                        take: 1
                    }
                },
                orderBy: { level: 'asc' }
            });

            await this.cacheManager.set(cacheKey, plans, 10 * 60 * 1000); // 10 دقیقه کش
            return plans;

        } catch (error) {
            this.logger.error('Error getting active plans:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    async getPlanByLevel(level: number, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const plan = await this.prisma.plan.findUnique({
                where: { level },
                include: {
                    contents: {
                        where: { language },
                        take: 1
                    }
                }
            });

            if (!plan) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            return plan;

        } catch (error) {
            this.logger.error('Error getting plan by level:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // ==================== خرید پلن ====================
    async purchasePlan(user_id: string, purchaseDto: PurchasePlanDto, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const { plan_level, payment_method, custom_amount } = purchaseDto;

            // بررسی وجود پلن
            const plan = await this.prisma.plan.findUnique({
                where: { level: plan_level },
                include: {
                    contents: {
                        where: { language },
                        take: 1
                    }
                }
            });

            if (!plan) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            if (plan.status !== PlanStatus.ACTIVE) {
                throw new I18nBadRequestException('SERVICE_UNAVAILABLE', language);
            }

            // محاسبه مبلغ نهایی
            const finalAmount = custom_amount || plan.price;
            const finalCredit = custom_amount ? custom_amount : plan.total_credit;

            // ایجاد سفارش
            const order = await this.prisma.order.create({
                data: {
                    order_number: this.generateOrderNumber(),
                    order_type: OrderType.PACKAGE_PURCHASE,
                    status: OrderStatus.PENDING,
                    user_id: user_id,
                    total_amount: finalAmount,
                    net_amount: finalAmount,
                    expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 دقیقه
                    metadata: {
                        plan_level,
                        plan_name: plan.contents[0]?.name || `Plan ${plan.level}`,
                        custom_amount,
                        final_credit: finalCredit,
                        expiry_days: plan.expiry_days
                    }
                }
            });

            // ایجاد تراکنش پرداخت
            const transaction = await this.prisma.transaction.create({
                data: {
                    transaction_number: this.generateTransactionNumber(),
                    status: TransactionStatus.PENDING,
                    order_id: order.id,
                    user_id: user_id,
                    amount: finalAmount,
                    net_amount: finalAmount,
                    transaction_type: TransactionType.DEBIT,
                    payment_method: payment_method
                }
            });

            // پرداخت از طریق کیف پول
            if (payment_method === PaymentMethod.CREDIT_BALANCE) {
                return await this.processWalletPayment(user_id, order.id, transaction.id, finalAmount, plan, custom_amount, language);
            }

            return {
                order,
                transaction,
                paymentUrl: this.generatePaymentUrl(transaction.id),
                plan: {
                    name: plan.contents[0]?.name || `Plan ${plan.level}`,
                    credit: finalCredit,
                    expiry_days: plan.expiry_days
                }
            };

        } catch (error) {
            this.logger.error('Error purchasing plan:', error);
            if (error instanceof I18nNotFoundException || error instanceof I18nBadRequestException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // پرداخت از طریق کیف پول
    private async processWalletPayment(
        user_id: string,
        orderId: string,
        transactionId: string,
        amount: number,
        plan: any,
        custom_amount?: number,
        language: Language = this.DEFAULT_LANGUAGE
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: user_id }
        });

        if (!user) {
            throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
        }

        if (user.wallet_balance < amount) {
            throw new I18nBadRequestException('INSUFFICIENT_FUNDS', language);
        }

        // استفاده از تراکنش برای اطمینان از صحت داده‌ها
        return await this.prisma.$transaction(async (tx) => {
            // کاهش موجودی کیف پول
            await tx.user.update({
                where: { id: user_id },
                data: {
                    wallet_balance: { decrement: amount }
                }
            });

            // بروزرسانی وضعیت تراکنش و سفارش
            const updatedTransaction = await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    status: TransactionStatus.SUCCESS,
                    completed_at: new Date()
                }
            });

            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: OrderStatus.PAID,
                    paid_at: new Date()
                }
            });

            // فعال‌سازی پلن برای کاربر
            await this.activatePlanForUser(user_id, orderId, plan, custom_amount, tx, language);

            return {
                order: updatedOrder,
                transaction: updatedTransaction,
                message: this.i18nService.t('ACTIVITY_DELETED_SUCCESS', language) // استفاده از پیام موفقیت موجود
            };
        });
    }

    // فعال‌سازی پلن برای کاربر
    private async activatePlanForUser(
        user_id: string,
        orderId: string,
        plan: any,
        custom_amount?: number,
        tx?: any,
        language: Language = this.DEFAULT_LANGUAGE
    ) {
        const prisma = tx || this.prisma;

        // محاسبه تاریخ انقضا
        const end_date = new Date();
        end_date.setDate(end_date.getDate() + plan.expiry_days);

        // محاسبه اعتبار نهایی
        const final_credit = custom_amount || plan.total_credit;

        // غیرفعال کردن پلن‌های قبلی کاربر
        await prisma.userPlan.updateMany({
            where: {
                user_id: user_id,
                is_active: true
            },
            data: {
                is_active: false
            }
        });

        // ایجاد پلن جدید برای کاربر
        const userPlan = await prisma.userPlan.create({
            data: {
                user_id: user_id,
                plan_id: plan.id,
                start_date: new Date(),
                end_date: end_date,
                initial_credit: final_credit,
                remaining_credit: final_credit,
                used_credit: 0,
                transaction_id: orderId,
                is_active: true
            }
        });

        // افزایش اعتبار کاربر
        await prisma.user.update({
            where: { id: user_id },
            data: {
                current_credit: { increment: final_credit },
                total_spent: { increment: plan.price }
            }
        });

        // پاک کردن کش
        await this.clearUserCache(user_id);

        return userPlan;
    }

    // ==================== دریافت وضعیت پلن کاربر ====================
    async getPlanStatus(user_id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `user_plan_status:${user_id}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            // دریافت کاربر با پلن فعال
            const userWithPlan = await this.prisma.user.findUnique({
                where: { id: user_id },
                include: {
                    user_plans: {
                        where: {
                            is_active: true,
                            end_date: { gt: new Date() }
                        },
                        include: {
                            plan: {
                                include: {
                                    contents: {
                                        where: { language },
                                        take: 1
                                    }
                                }
                            }
                        },
                        orderBy: {
                            created_at: 'desc'
                        },
                        take: 1
                    }
                }
            });

            if (!userWithPlan) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            const activeUserPlan = userWithPlan.user_plans[0];
            const activePlan = activeUserPlan?.plan;
            const planContent = activePlan?.contents[0];

            let daysRemaining = 0;
            if (activeUserPlan) {
                const now = new Date();
                const end = new Date(activeUserPlan.end_date);
                const diffTime = end.getTime() - now.getTime();
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            const result = {
                user: {
                    current_credit: userWithPlan.current_credit,
                    bonus_credit: userWithPlan.bonus_credit,
                    total_spent: userWithPlan.total_spent,
                    total_available_credit: userWithPlan.current_credit + userWithPlan.bonus_credit
                },
                active_plan: activePlan ? {
                    id: activePlan.id,
                    name: planContent?.name || `Plan ${activePlan.level}`,
                    level: activePlan.level,
                    credit_amount: activePlan.credit_amount,
                    bonus_credit: activePlan.bonus_credit,
                    total_credit: activePlan.total_credit,
                    benefits: planContent?.benefits || [],
                    start_date: activeUserPlan.start_date,
                    end_date: activeUserPlan.end_date,
                    days_remaining: daysRemaining > 0 ? daysRemaining : 0,
                    initial_credit: activeUserPlan.initial_credit,
                    remaining_credit: activeUserPlan.remaining_credit,
                    used_credit: activeUserPlan.used_credit
                } : null,
                plan_history: await this.getUserPlanHistory(user_id, language)
            };

            await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
            return result;

        } catch (error) {
            this.logger.error('Error getting plan status:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // دریافت تاریخچه پلن‌های کاربر
    private async getUserPlanHistory(user_id: string, language: Language = this.DEFAULT_LANGUAGE) {
        return this.prisma.userPlan.findMany({
            where: { user_id: user_id },
            include: {
                plan: {
                    include: {
                        contents: {
                            where: { language },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { created_at: 'desc' },
            take: 10
        });
    }

    // ==================== سرویس‌های ادمین ====================

    async getAllUsersPlanStatus(page: number = 1, limit: number = 10, search?: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const skip = (page - 1) * limit;

            const where: any = {};
            if (search) {
                where.OR = [
                    {
                        contents: {
                            some: {
                                first_name: { contains: search, mode: 'insensitive' }
                            }
                        }
                    },
                    {
                        contents: {
                            some: {
                                last_name: { contains: search, mode: 'insensitive' }
                            }
                        }
                    },
                    { mobile: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [users, total] = await Promise.all([
                this.prisma.user.findMany({
                    where,
                    include: {
                        contents: {
                            where: { language },
                            take: 1
                        },
                        user_plans: {
                            where: {
                                is_active: true,
                                end_date: { gt: new Date() }
                            },
                            include: {
                                plan: {
                                    include: {
                                        contents: {
                                            where: { language },
                                            take: 1
                                        }
                                    }
                                }
                            },
                            take: 1
                        }
                    },
                    orderBy: { created_at: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.user.count({ where }),
            ]);

            const usersWithPlanStatus = users.map(user => {
                const userContent = user.contents[0];
                const activePlan = user.user_plans[0]?.plan;
                const planContent = activePlan?.contents[0];

                return {
                    id: user.id,
                    first_name: userContent?.first_name || this.i18nService.t('UNKNOWN_USER', language),
                    last_name: userContent?.last_name || '',
                    mobile: user.mobile,
                    email: user.email,
                    current_credit: user.current_credit,
                    bonus_credit: user.bonus_credit,
                    total_spent: user.total_spent,
                    created_at: user.created_at,
                    is_blocked: user.is_blocked,
                    total_available_credit: user.current_credit + user.bonus_credit,
                    active_plan: activePlan ? {
                        name: planContent?.name || `Plan ${activePlan.level}`,
                        level: activePlan.level,
                        total_credit: activePlan.total_credit
                    } : null,
                    has_active_plan: !!activePlan
                };
            });

            return {
                data: usersWithPlanStatus,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };

        } catch (error) {
            this.logger.error('Error getting all users plan status:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // مدیریت انقضای پلن‌ها
    async handleExpiredPlans(language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const now = new Date();

            const expiredUserPlans = await this.prisma.userPlan.findMany({
                where: {
                    end_date: { lt: now },
                    is_active: true,
                    remaining_credit: { gt: 0 }
                },
                include: {
                    user: true,
                    plan: true
                }
            });

            let processedCount = 0;

            for (const userPlan of expiredUserPlans) {
                await this.prisma.$transaction(async (tx) => {
                    // غیرفعال کردن پلن
                    await tx.userPlan.update({
                        where: { id: userPlan.id },
                        data: {
                            is_active: false,
                            remaining_credit: 0
                        }
                    });

                    // کاهش اعتبار کاربر (اگر اعتبار باقیمانده داره)
                    if (userPlan.remaining_credit > 0) {
                        await tx.user.update({
                            where: { id: userPlan.user_id },
                            data: {
                                current_credit: {
                                    decrement: userPlan.remaining_credit
                                }
                            }
                        });
                    }

                    processedCount++;
                });

                // پاک کردن کش کاربر
                await this.clearUserCache(userPlan.user_id);
            }

            return {
                expired_plans_processed: processedCount,
                message: this.i18nService.t('OLD_ACTIVITIES_CLEANED_SUCCESS', language, {
                    count: processedCount,
                    days: 0
                })
            };

        } catch (error) {
            this.logger.error('Error handling expired plans:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private generateOrderNumber(): string {
        return `ORD${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateTransactionNumber(): string {
        return `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    }

    private generatePaymentUrl(transactionId: string): string {
        return `/payment/gateway/${transactionId}`;
    }

    private async clearUserCache(user_id: string): Promise<void> {
        const cacheKeys = [
            `user_plan_status:${user_id}:*`,
        ];
        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }

    private async clearPlansCache(): Promise<void> {
        const cacheKeys = [
            'active_plans:*',
        ];
        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }
}