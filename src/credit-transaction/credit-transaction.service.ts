// src/credit-transaction/credit-transaction.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { CreateCreditTransactionDto } from './dto/create-credit-transaction.dto';
import { CreditTransactionQueryDto } from './dto/credit-transaction-query.dto';
import { TransactionType, Language } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from "../prisma/prisma.service";
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nInternalServerErrorException
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class CreditTransactionService {
    private readonly logger = new Logger(CreditTransactionService.name);
    private readonly DEFAULT_LANGUAGE = Language.fa;

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    // ایجاد تراکنش اعتباری جدید
    async create(createDto: CreateCreditTransactionDto, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            // محاسبه balance_after
            const user = await this.prisma.user.findUnique({
                where: { id: createDto.user_id },
                select: {
                    current_credit: true,
                    bonus_credit: true,
                    contents: {
                        where: { language },
                        take: 1
                    }
                }
            });

            if (!user) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            const currentBalance = user.current_credit + user.bonus_credit;
            const balanceAfter = currentBalance + createDto.amount;

            const transaction = await this.prisma.creditTransaction.create({
                data: {
                    ...createDto,
                    balance_after: balanceAfter,
                },
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

            // پاک کردن کش مربوطه
            await this.clearUserTransactionsCache(createDto.user_id);

            this.logger.log(`Credit transaction created for user: ${createDto.user_id}, Amount: ${createDto.amount}`);
            return transaction;

        } catch (error) {
            this.logger.error('Error creating credit transaction:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // دریافت تراکنش‌های یک کاربر
    async findByUser(user_id: string, query: CreditTransactionQueryDto = {}, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `user_transactions:${user_id}:${JSON.stringify(query)}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const { page = 1, limit = 10, activity_type, transactionType, startDate, endDate } = query;
            const skip = (page - 1) * limit;

            const where: any = { user_id: user_id };

            if (activity_type) {
                where.activity_type = activity_type;
            }

            if (transactionType) {
                where.credit_transaction_type = transactionType;
            }

            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = new Date(startDate);
                if (endDate) where.created_at.lte = new Date(endDate);
            }

            const [transactions, total] = await Promise.all([
                this.prisma.creditTransaction.findMany({
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
                        credit_activities: {
                            include: {
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
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.creditTransaction.count({ where }),
            ]);

            const result = {
                data: transactions,
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
            this.logger.error('Error getting user transactions:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // دریافت یک تراکنش خاص
    async findOne(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const transaction = await this.prisma.creditTransaction.findUnique({
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
                    credit_activities: {
                        include: {
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
                    }
                }
            });

            if (!transaction) {
                throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
            }

            return transaction;

        } catch (error) {
            this.logger.error('Error getting transaction:', error);
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // ==================== سرویس‌های ادمین ====================

    // جستجو در تمام تراکنش‌ها
    async findAllAdmin(query: CreditTransactionQueryDto, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `admin_transactions:${JSON.stringify(query)}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const { page = 1, limit = 10, user_id, activity_type, transactionType, startDate, endDate } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (user_id) {
                where.user_id = user_id;
            }

            if (activity_type) {
                where.activity_type = activity_type;
            }

            if (transactionType) {
                where.credit_transaction_type = transactionType;
            }

            if (startDate || endDate) {
                where.created_at = {};
                if (startDate) where.created_at.gte = new Date(startDate);
                if (endDate) where.created_at.lte = new Date(endDate);
            }

            const [transactions, total] = await Promise.all([
                this.prisma.creditTransaction.findMany({
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
                        credit_activities: {
                            include: {
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
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' },
                    skip,
                    take: limit,
                }),
                this.prisma.creditTransaction.count({ where }),
            ]);

            const result = {
                data: transactions,
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
            this.logger.error('Error getting admin transactions:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    // دریافت آمار تراکنش‌ها
    async getTransactionsStats(language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `transactions_stats:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }

            const [
                totalTransactions,
                todayTransactions,
                totalCreditAdded,
                totalCreditUsed,
                activityTypesStats
            ] = await Promise.all([
                this.prisma.creditTransaction.count(),
                this.prisma.creditTransaction.count({
                    where: {
                        created_at: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0))
                        }
                    }
                }),
                this.prisma.creditTransaction.aggregate({
                    _sum: { amount: true },
                    where: {
                        credit_transaction_type: TransactionType.CREDIT,
                        amount: { gt: 0 }
                    }
                }),
                this.prisma.creditTransaction.aggregate({
                    _sum: { amount: true },
                    where: {
                        credit_transaction_type: TransactionType.DEBIT,
                        amount: { lt: 0 }
                    }
                }),
                this.prisma.creditTransaction.groupBy({
                    by: ['activity_type'],
                    _count: { id: true },
                    _sum: { amount: true },
                    where: {
                        created_at: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    }
                })
            ]);

            const stats = {
                totalTransactions,
                todayTransactions,
                totalCreditAdded: totalCreditAdded._sum.amount || 0,
                totalCreditUsed: Math.abs(totalCreditUsed._sum.amount || 0),
                activityTypes: activityTypesStats.map(stat => ({
                    activity_type: stat.activity_type,
                    count: stat._count.id,
                    totalAmount: stat._sum.amount
                }))
            };

            await this.cacheManager.set(cacheKey, stats, 10 * 60 * 1000);
            return stats;

        } catch (error) {
            this.logger.error('Error getting transactions stats:', error);
            throw new I18nInternalServerErrorException('DATABASE_ERROR', language);
        }
    }

    private async clearUserTransactionsCache(user_id: string): Promise<void> {
        const cacheKeys = [
            `user_transactions:${user_id}:*`,
            `user_plan_status:${user_id}`,
        ];

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    }
}