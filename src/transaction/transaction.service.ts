// src/services/transaction/transaction.service.ts
import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Inject,
    ForbiddenException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import {
    TransactionStatus,
    TransactionType,
    PaymentMethod,
    Prisma,
    Language
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class TransactionService {
    constructor(
        private prisma: PrismaService,
        private paymentService: PaymentService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {
    }

    private readonly CACHE_TTL = 10 * 60 * 1000;
    private readonly DEFAULT_LANGUAGE = Language.fa;

    // ==================== ایجاد تراکنش جدید ====================
    async create(createTransactionDto: CreateTransactionDto, userId: string) {
        const {order_id, ...transactionData} = createTransactionDto;

        const order = await this.prisma.order.findUnique({
            where: {id: order_id},
            include: {
                user: {
                    include: {
                        contents: {
                            where: {language: this.DEFAULT_LANGUAGE},
                            take: 1
                        }
                    }
                }
            }
        });

        if (!order) {
            throw new NotFoundException('سفارش یافت نشد');
        }

        if (order.user_id !== userId) {
            throw new ForbiddenException('دسترسی به این سفارش ندارید');
        }

        // بررسی وجود تراکنش موفق برای این سفارش
        const existingSuccessfulTransaction = await this.prisma.transaction.findFirst({
            where: {
                order_id: order_id,
                status: TransactionStatus.SUCCESS
            }
        });

        if (existingSuccessfulTransaction) {
            throw new BadRequestException('برای این سفارش قبلاً تراکنش موفق ثبت شده است');
        }

        const transactionNumber = this.generateTransactionNumber();

        const transaction = await this.prisma.transaction.create({
            data: {
                ...transactionData,
                transaction_number: transactionNumber,
                order_id: order_id,
                user_id: userId,
                net_amount: transactionData.amount - (transactionData.fee || 0),
                currency: 'IRR',
                status: TransactionStatus.PENDING,
                metadata: {
                    created_via: 'MANUAL',
                    created_by: userId,
                    created_at: new Date().toISOString()
                }
            },
            include: {
                order: {
                    select: {
                        id: true,
                        order_number: true,
                        net_amount: true,
                        user: {
                            select: {
                                id: true,
                                user_name: true,
                                contents: {
                                    where: {language: this.DEFAULT_LANGUAGE},
                                    select: {first_name: true, last_name: true},
                                    take: 1
                                }
                            }
                        }
                    }
                },
                user: {
                    select: {
                        id: true,
                        user_name: true,
                        contents: {
                            where: {language: this.DEFAULT_LANGUAGE},
                            select: {first_name: true, last_name: true},
                            take: 1
                        }
                    }
                }
            }
        });

        await this.clearTransactionCaches(userId, order_id);

        return this.enrichTransactionWithContent(transaction, this.DEFAULT_LANGUAGE);
    }

    // ==================== شروع پرداخت آنلاین ====================
    // ==================== شروع پرداخت آنلاین ====================
    // ==================== شروع پرداخت آنلاین ====================
    async initiateOnlinePayment(orderId: string, userId: string, callbackUrl: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                },
                items: {
                    include: {
                        product: {
                            include: {
                                contents: {
                                    where: { language: this.DEFAULT_LANGUAGE },
                                    take: 1
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            throw new NotFoundException('سفارش یافت نشد');
        }

        if (order.user_id !== userId) {
            throw new ForbiddenException('دسترسی به این سفارش ندارید');
        }

        // بررسی وجود تراکنش در حال انتظار
        const existingPendingTransaction = await this.prisma.transaction.findFirst({
            where: {
                order_id: orderId,
                status: TransactionStatus.PENDING,
                payment_method: PaymentMethod.ONLINE_GATEWAY
            }
        });

        if (existingPendingTransaction) {
            throw new BadRequestException('برای این سفارش قبلاً تراکنش در حال انتظار وجود دارد');
        }

        // ایجاد تراکنش جدید برای پرداخت آنلاین
        const transactionNumber = this.generateTransactionNumber();

        const transaction = await this.prisma.transaction.create({
            data: {
                transaction_number: transactionNumber,
                order_id: orderId,
                user_id: userId,
                amount: order.net_amount,
                fee: Math.round(order.net_amount * 0.01), // 1% کارمزد
                net_amount: order.net_amount - Math.round(order.net_amount * 0.01),
                currency: 'IRR',
                transaction_type: TransactionType.DEBIT,
                payment_method: PaymentMethod.ONLINE_GATEWAY,
                status: TransactionStatus.PENDING,
                description: `پرداخت آنلاین برای سفارش ${order.order_number}`,
                metadata: {
                    payment_initiated: true,
                    callback_url: callbackUrl,
                    initiated_at: new Date().toISOString(),
                    order_details: {
                        order_number: order.order_number,
                        total_items: order.items.length,
                        item_names: order.items.map(item =>
                            item.product?.contents[0]?.name || 'محصول'
                        )
                    }
                }
            }
        });

        // شروع پرداخت از طریق سرویس پرداخت
        const paymentResult = await this.paymentService.initiateOrderPayment(
            orderId,
            userId,
            callbackUrl
        );

        // بروزرسانی تراکنش با اطلاعات درگاه - استفاده از ساختار واقعی
        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                gateway_reference: paymentResult.gateway_reference, // ✅ استفاده از gateway_reference
                gateway_response: {
                    gateway: this.paymentService.getGatewayName(), // ✅ گرفتن نام درگاه از سرویس
                    order_number: paymentResult.order_number,
                    initiated_at: new Date().toISOString(),
                    success: true,
                    payment_url: paymentResult.payment_url,
                    transaction_id: paymentResult.transaction_id,
                    gateway_reference: paymentResult.gateway_reference,
                    amount: paymentResult.amount,
                    error_code: null,
                    error_message: null
                } as any,
                metadata: {
                    ...(transaction.metadata as any),
                    gateway_info: {
                        gateway: this.paymentService.getGatewayName(), // ✅ گرفتن نام درگاه
                        payment_id: paymentResult.transaction_id, // ✅ استفاده از transaction_id
                        redirect_url: paymentResult.payment_url, // ✅ استفاده از payment_url
                        transaction_id: transaction.id
                    }
                }
            }
        });

        await this.clearTransactionCaches(userId, orderId);

        return {
            transaction: this.enrichTransactionWithContent(transaction, this.DEFAULT_LANGUAGE),
            payment: {
                transaction_id: paymentResult.transaction_id,
                payment_url: paymentResult.payment_url,
                gateway_reference: paymentResult.gateway_reference,
                amount: paymentResult.amount,
                order_number: paymentResult.order_number,
                gateway: this.paymentService.getGatewayName() // ✅ اضافه کردن نام درگاه
            }
        };
    }

    // ==================== دریافت تراکنش‌های کاربر ====================
    async findAllByUser(query: TransactionQueryDto, userId: string) {
        const cacheKey = `user_transactions:${userId}:${JSON.stringify(query)}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 10, status, transaction_type, payment_method, order_id, search } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.TransactionWhereInput = { user_id: userId };

        if (status) where.status = status;
        if (transaction_type) where.transaction_type = transaction_type;
        if (payment_method) where.payment_method = payment_method;
        if (order_id) where.order_id = order_id;

        if (search) {
            where.OR = [
                { transaction_number: { contains: search, mode: 'insensitive' } },
                { gateway_reference: { contains: search, mode: 'insensitive' } },
                {
                    order: {
                        order_number: { contains: search, mode: 'insensitive' }
                    }
                },
                {
                    description: { contains: search, mode: 'insensitive' }
                }
            ];
        }

        const [transactions, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where,
                skip,
                take: limit,
                include: {
                    order: {
                        select: {
                            id: true,
                            order_number: true,
                            total_amount: true,
                            status: true,
                            user_id: true,
                            // فقط فیلدهای اصلی order
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            user_name: true,
                            // محتوای کاربر رو جداگانه می‌گیریم
                        }
                    },
                    // credit_transaction رابطه مستقیم نداره، پس جداگانه می‌گیریم
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.transaction.count({ where }),
        ]);

        // گرفتن اطلاعات credit_transaction به صورت جداگانه
        const transactionIds = transactions.map(t => t.id);
        const creditTransactions = await this.prisma.creditTransaction.findMany({
            where: {
                transaction_id: { in: transactionIds }
            },
            select: {
                id: true,
                transaction_id: true,
                amount: true,
                activity_type: true,
                description: true,
            }
        });

        // ایجاد مپ برای دسترسی سریع
        const creditTransactionMap = new Map();
        creditTransactions.forEach(ct => {
            creditTransactionMap.set(ct.transaction_id, ct);
        });

        // گرفتن محتوای کاربران
        const userIds = transactions.map(t => t.user_id);
        const userContents = await this.prisma.userContent.findMany({
            where: {
                user_id: { in: userIds },
                language: this.DEFAULT_LANGUAGE
            },
            select: {
                user_id: true,
                first_name: true,
                last_name: true
            }
        });

        const userContentMap = new Map();
        userContents.forEach(uc => {
            userContentMap.set(uc.user_id, uc);
        });

        // غنی‌سازی تراکنش‌ها
        const enrichedTransactions = transactions.map(transaction => {
            const userContent = userContentMap.get(transaction.user_id);
            const creditTransaction = creditTransactionMap.get(transaction.id);

            return {
                ...transaction,
                // غنی‌سازی اطلاعات کاربر
                user: transaction.user ? {
                    ...transaction.user,
                    first_name: userContent?.first_name,
                    last_name: userContent?.last_name,
                    display_name: this.getUserDisplayName(transaction.user, userContent)
                } : null,
                // اضافه کردن credit_transaction
                credit_transaction: creditTransaction || null,
                // خلاصه اطلاعات
                summary: {
                    is_online_payment: transaction.payment_method === PaymentMethod.ONLINE_GATEWAY,
                    can_refund: this.canRefundTransaction(transaction),
                    can_retry: this.canRetryTransaction(transaction),
                    payment_gateway: this.getPaymentGatewayInfo(transaction),
                    has_credit_transaction: !!creditTransaction,
                    is_successful: transaction.status === TransactionStatus.SUCCESS,
                    is_pending: transaction.status === TransactionStatus.PENDING
                }
            };
        });

        const result = {
            data: enrichedTransactions,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                summary: {
                    total_transactions: total,
                    total_amount: transactions.reduce((sum, t) => sum + t.amount, 0),
                    status_breakdown: this.calculateStatusBreakdown(transactions),
                    total_with_credit: creditTransactions.length, // ✅ اصلاح شده
                    success_rate: this.calculateSuccessRate(transactions)
                }
            },
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    // ==================== دریافت جزئیات تراکنش ====================
    async findOne(id: string, userId: string) {
        const cacheKey = `transaction:${id}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        // ابتدا تراکنش اصلی رو بگیر
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
            include: {
                order: {
                    select: {
                        id: true,
                        order_number: true,
                        total_amount: true,
                        status: true,
                        user_id: true,
                        seller_id: true,
                        // سایر فیلدهای مورد نیاز
                    }
                },
                user: {
                    select: {
                        id: true,
                        user_name: true,
                        email: true,
                        mobile: true,
                    }
                }
            }
        });

        if (!transaction) {
            throw new NotFoundException('تراکنش یافت نشد');
        }

        if (transaction.user_id !== userId) {
            throw new ForbiddenException('دسترسی به این تراکنش ندارید');
        }

        // گرفتن اطلاعات مرتبط به صورت جداگانه
        const [creditTransaction, userContent, orderItems, sellerInfo] = await Promise.all([
            // Credit Transaction
            this.prisma.creditTransaction.findFirst({
                where: { transaction_id: id },
                include: {
                    credit_activities: {
                        include: {
                            product: {
                                include: {
                                    contents: {
                                        where: { language: this.DEFAULT_LANGUAGE },
                                        take: 1
                                    }
                                }
                            },
                            account: {
                                include: {
                                    contents: {
                                        where: { language: this.DEFAULT_LANGUAGE },
                                        take: 1
                                    }
                                }
                            }
                        }
                    }
                }
            }),

            // User Content
            this.prisma.userContent.findFirst({
                where: {
                    user_id: transaction.user_id,
                    language: this.DEFAULT_LANGUAGE
                }
            }),

            // Order Items
            this.prisma.orderItem.findMany({
                where: { order_id: transaction.order_id },
                include: {
                    product: {
                        include: {
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                take: 1
                            },
                            account: {
                                include: {
                                    contents: {
                                        where: { language: this.DEFAULT_LANGUAGE },
                                        take: 1
                                    }
                                }
                            }
                        }
                    }
                }
            }),

            // Seller Info (اگر seller_id وجود دارد)
            transaction.order?.seller_id ? this.prisma.user.findUnique({
                where: { id: transaction.order.seller_id },
                select: {
                    id: true,
                    user_name: true,
                    contents: {
                        where: { language: this.DEFAULT_LANGUAGE },
                        take: 1
                    }
                }
            }) : Promise.resolve(null)
        ]);

        // غنی‌سازی تراکنش
        const enrichedTransaction = {
            ...transaction,
            user: {
                ...transaction.user,
                first_name: userContent?.first_name,
                last_name: userContent?.last_name,
                display_name: this.getUserDisplayName(transaction.user, userContent)
            },
            credit_transaction: creditTransaction,
            order: transaction.order ? {
                ...transaction.order,
                items: orderItems,
                seller: sellerInfo ? {
                    ...sellerInfo,
                    display_name: this.getUserDisplayName(sellerInfo, sellerInfo.contents?.[0])
                } : null
            } : null
        };

        const transactionWithDetails = {
            ...enrichedTransaction,
            details: {
                is_online_payment: transaction.payment_method === PaymentMethod.ONLINE_GATEWAY,
                can_refund: this.canRefundTransaction(transaction),
                can_retry: this.canRetryTransaction(transaction),
                payment_gateway: this.getPaymentGatewayInfo(transaction),
                refund_info: this.getRefundInfo(transaction),
                timeline: this.getTransactionTimeline(transaction),
                security: {
                    is_verified: !!transaction.verified_at,
                    verified_by: transaction.verified_by,
                    verification_method: this.getVerificationMethod(transaction)
                }
            }
        };

        await this.cacheManager.set(cacheKey, transactionWithDetails, this.CACHE_TTL);
        return transactionWithDetails;
    }

    // ==================== درخواست بازپرداخت ====================
    async requestRefund(transactionId: string, userId: string, reason?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                order: true,
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!transaction) {
            throw new NotFoundException('تراکنش یافت نشد');
        }

        if (transaction.user_id !== userId) {
            throw new ForbiddenException('دسترسی به این تراکنش ندارید');
        }

        if (!this.canRefundTransaction(transaction)) {
            throw new BadRequestException('این تراکنش قابل بازپرداخت نیست');
        }

        // بررسی وجود درخواست بازپرداخت قبلی - استفاده از روش ساده‌تر
        let existingRefundRequest = await this.prisma.transaction.findFirst({
            where: {
                AND: [
                    {
                        // روش ساده: جستجو در description
                        description: {
                            contains: `بازپرداخت تراکنش ${transaction.transaction_number}`
                        }
                    },
                    {
                        status: {
                            in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING]
                        }
                    },
                    {
                        transaction_type: TransactionType.CREDIT
                    }
                ]
            }
        });

        // اگر با description پیدا نشد، از روش فیلتر JSON استفاده کن
        if (!existingRefundRequest) {
            // روش جایگزین: گرفتن تمام تراکنش‌های بازپرداخت و فیلتر در memory
            const allPendingRefunds = await this.prisma.transaction.findMany({
                where: {
                    transaction_type: TransactionType.CREDIT,
                    status: {
                        in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING]
                    },
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // فقط 7 روز گذشته
                    }
                },
                select: {
                    id: true,
                    metadata: true,
                    description: true
                }
            });

            // فیلتر در memory برای پیدا کردن تراکنش مربوطه
            existingRefundRequest = allPendingRefunds.find(t => {
                try {
                    if (!t.metadata) return false;
                    const metadata = t.metadata as any;
                    return metadata.original_transaction_id === transactionId;
                } catch {
                    return false;
                }
            }) as any;
        }

        if (existingRefundRequest) {
            throw new BadRequestException('برای این تراکنش قبلاً درخواست بازپرداخت ثبت شده است');
        }

        const refundTransaction = await this.prisma.transaction.create({
            data: {
                transaction_number: this.generateTransactionNumber(),
                order_id: transaction.order_id,
                user_id: userId,
                amount: transaction.amount,
                fee: 0,
                net_amount: transaction.amount,
                currency: 'IRR',
                transaction_type: TransactionType.CREDIT,
                payment_method: transaction.payment_method,
                status: TransactionStatus.PENDING,
                refund_amount: transaction.amount,
                refund_reason: reason,
                description: `بازپرداخت تراکنش ${transaction.transaction_number}`,
                metadata: {
                    refund_request: true,
                    original_transaction_id: transactionId,
                    refund_reason: reason,
                    requested_at: new Date().toISOString(),
                    requested_by: userId,
                    original_transaction_details: {
                        amount: transaction.amount,
                        payment_method: transaction.payment_method,
                        completed_at: transaction.completed_at,
                        transaction_number: transaction.transaction_number
                    }
                }
            },
            include: {
                order: {
                    select: {
                        id: true,
                        order_number: true
                    }
                },
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        await this.clearTransactionCaches(userId, transaction.order_id);

        return {
            refund_transaction: this.enrichTransactionWithContent(refundTransaction, this.DEFAULT_LANGUAGE),
            message: 'درخواست بازپرداخت ثبت شد و در حال بررسی است'
        };
    }
    // ==================== تأیید پرداخت توسط درگاه ====================
    // ==================== تأیید پرداخت توسط درگاه ====================
    async verifyPayment(paymentId: string, gatewayData: any) {
        // پیدا کردن تراکنش بر اساس payment_id (gateway_reference)
        const transaction = await this.prisma.transaction.findFirst({
            where: {
                gateway_reference: paymentId
            },
            include: {
                order: true,
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!transaction) {
            throw new NotFoundException('تراکنش یافت نشد');
        }

        // بررسی وضعیت فعلی تراکنش
        if (transaction.status !== TransactionStatus.PENDING) {
            throw new BadRequestException('تراکنش در وضعیت انتظار نیست');
        }

        // فراخوانی سرویس پرداخت برای تأیید
        const verificationResult = await this.paymentService.verifyPayment(
            paymentId,
            gatewayData
        );

        // ساخت data object بر اساس موفقیت یا شکست
        const updateData: any = {
            gateway_response: {
                ...(transaction.gateway_response as any),
                verification: verificationResult,
                verified_at: new Date().toISOString()
            },
            metadata: {
                ...(transaction.metadata as any),
                payment_verified: true,
                verification_result: verificationResult,
                verified_at: new Date().toISOString()
            }
        };

        if (verificationResult.success) {
            updateData.status = TransactionStatus.SUCCESS;
            updateData.completed_at = new Date();

            // بروزرسانی وضعیت سفارش
            await this.prisma.order.update({
                where: { id: transaction.order_id },
                data: {
                    status: 'PAID',
                    paid_at: new Date(),
                    metadata: {
                        ...(transaction.order.metadata as any),
                        payment_completed: true,
                        payment_transaction_id: transaction.id,
                        paid_at: new Date().toISOString()
                    }
                }
            });

            // ایجاد تراکنش اعتباری
            await this.createCreditForSuccessfulPayment(transaction);
        } else {
            updateData.status = TransactionStatus.FAILED;
            updateData.completed_at = new Date();

            // استفاده از message به جای error_message
            updateData.error_message = verificationResult.message;

            // اگر error_code وجود دارد استفاده کن، در غیر این صورت از کد پیشفرض
            updateData.error_code = 'PAYMENT_FAILED';
        }

        const updatedTransaction = await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: updateData,
            include: {
                order: {
                    include: {
                        user: {
                            include: {
                                contents: {
                                    where: { language: this.DEFAULT_LANGUAGE },
                                    take: 1
                                }
                            }
                        }
                    }
                },
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        await this.clearTransactionCaches(transaction.user_id, transaction.order_id);

        return {
            transaction: this.enrichTransactionWithContent(updatedTransaction, this.DEFAULT_LANGUAGE),
            verification: verificationResult
        };
    }

// ==================== ایجاد اعتبار برای پرداخت موفق ====================
    private async createCreditForSuccessfulPayment(transaction: any) {
        // ایجاد تراکنش اعتباری برای پرداخت موفق
        await this.prisma.creditTransaction.create({
            data: {
                user_id: transaction.user_id,
                amount: transaction.amount,
                balance_after: 0, // باید از موجودی کاربر محاسبه شود
                activity_type: 'ORDER_PAYMENT',
                description: `پرداخت سفارش ${transaction.order?.order_number} - روش پرداخت: ${transaction.payment_method}`,
                credit_transaction_type: TransactionType.DEBIT,
                transaction_id: transaction.id,
                // حذف metadata و انتقال اطلاعات به description
            }
        });

        // اگر نیاز به ذخیره اطلاعات اضافی دارید، می‌توانید از جدول جداگانه استفاده کنید
        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                gateway_response: {
                    ...(transaction.gateway_response as any),
                    credit_created: true,
                    credit_created_at: new Date().toISOString(),
                    order_payment_details: {
                        order_id: transaction.order_id,
                        payment_method: transaction.payment_method
                    }
                }
            }
        });
    }


    // ==================== متدهای ادمین ====================
    async updateTransactionStatus(transactionId: string, status: TransactionStatus, adminId: string, reason?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                order: true,
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!transaction) {
            throw new NotFoundException('تراکنش یافت نشد');
        }

        // اعتبارسنجی تغییر وضعیت
        if (!this.isValidStatusTransition(transaction.status, status)) {
            throw new BadRequestException(
                `تغییر وضعیت از ${transaction.status} به ${status} مجاز نیست`
            );
        }

        const updateData: any = {
            status,
            notes: reason
        };

        // اگر وضعیت به "موفق" تغییر کرد
        if (status === TransactionStatus.SUCCESS) {
            updateData.verified_by = adminId;
            updateData.verified_at = new Date();
            updateData.completed_at = new Date();

            // بروزرسانی وضعیت سفارش
            await this.prisma.order.update({
                where: { id: transaction.order_id },
                data: {
                    status: 'PAID',
                    paid_at: new Date()
                }
            });
        }

        // اگر وضعیت به "ناموفق" تغییر کرد
        if (status === TransactionStatus.FAILED) {
            updateData.completed_at = new Date();
        }

        updateData.gateway_response = {
            ...(transaction.gateway_response as any),
            admin_verified: status === TransactionStatus.SUCCESS,
            verified_by: adminId,
            verified_at: new Date().toISOString(),
            verification_reason: reason,
            status_changed_by: adminId,
            status_changed_at: new Date().toISOString()
        };

        const updatedTransaction = await this.prisma.transaction.update({
            where: { id: transactionId },
            data: updateData,
            include: {
                order: {
                    select: {
                        id: true,
                        order_number: true,
                        user_id: true
                    }
                },
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        await this.clearTransactionCaches(transaction.user_id, transaction.order_id);

        return this.enrichTransactionWithContent(updatedTransaction, this.DEFAULT_LANGUAGE);
    }

    async approveRefund(transactionId: string, adminId: string, notes?: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                order: true,
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!transaction) {
            throw new NotFoundException('تراکنش یافت نشد');
        }

        if (transaction.transaction_type !== TransactionType.CREDIT || !transaction.refund_amount) {
            throw new BadRequestException('این تراکنش قابل بازپرداخت نیست');
        }

        if (transaction.status !== TransactionStatus.PENDING) {
            throw new BadRequestException('فقط تراکنش‌های در حال انتظار قابل تأیید هستند');
        }

        const updatedTransaction = await this.prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: TransactionStatus.SUCCESS,
                refunded_at: new Date(),
                verified_by: adminId,
                verified_at: new Date(),
                notes: notes,
                gateway_response: {
                    ...(transaction.gateway_response as any),
                    refund_approved: true,
                    approved_by: adminId,
                    approved_at: new Date().toISOString(),
                    approval_notes: notes
                }
            },
            include: {
                order: {
                    include: {
                        user: {
                            include: {
                                contents: {
                                    where: { language: this.DEFAULT_LANGUAGE },
                                    take: 1
                                }
                            }
                        }
                    }
                },
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        // ایجاد تراکنش اعتباری برای کاربر
        await this.createCreditTransactionForRefund(transaction, adminId);

        await this.clearTransactionCaches(transaction.user_id, transaction.order_id);

        return {
            transaction: this.enrichTransactionWithContent(updatedTransaction, this.DEFAULT_LANGUAGE),
            message: 'بازپرداخت با موفقیت تأیید شد'
        };
    }

    async rejectRefund(transactionId: string, adminId: string, reason: string) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id: transactionId }
        });

        if (!transaction) {
            throw new NotFoundException('تراکنش یافت نشد');
        }

        const updatedTransaction = await this.prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: TransactionStatus.FAILED,
                verified_by: adminId,
                verified_at: new Date(),
                notes: reason,
                gateway_response: {
                    ...(transaction.gateway_response as any),
                    refund_rejected: true,
                    rejected_by: adminId,
                    rejected_at: new Date().toISOString(),
                    rejection_reason: reason
                }
            },
            include: {
                order: {
                    select: {
                        id: true,
                        order_number: true
                    }
                },
                user: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        await this.clearTransactionCaches(transaction.user_id, transaction.order_id);

        return {
            transaction: this.enrichTransactionWithContent(updatedTransaction, this.DEFAULT_LANGUAGE),
            message: 'درخواست بازپرداخت رد شد'
        };
    }

    // ==================== آمار و گزارشات ====================
    async getTransactionStats(userId?: string) {
        const cacheKey = `transaction_stats:${userId || 'global'}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const where: Prisma.TransactionWhereInput = userId ? { user_id: userId } : {};

        const [
            totalTransactions,
            successfulTransactions,
            failedTransactions,
            pendingTransactions,
            totalAmount,
            refundedAmount,
            todayTransactions,
            monthlyTrend
        ] = await Promise.all([
            this.prisma.transaction.count({ where }),
            this.prisma.transaction.count({
                where: { ...where, status: TransactionStatus.SUCCESS }
            }),
            this.prisma.transaction.count({
                where: { ...where, status: TransactionStatus.FAILED }
            }),
            this.prisma.transaction.count({
                where: { ...where, status: TransactionStatus.PENDING }
            }),
            this.prisma.transaction.aggregate({
                where: { ...where, status: TransactionStatus.SUCCESS },
                _sum: { amount: true }
            }),
            this.prisma.transaction.aggregate({
                where: {
                    ...where,
                    status: TransactionStatus.SUCCESS,
                    refund_amount: { not: null }
                },
                _sum: { refund_amount: true }
            }),
            this.prisma.transaction.count({
                where: {
                    ...where,
                    created_at: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),
            this.getMonthlyTransactionTrend(where)
        ]);

        const stats = {
            overview: {
                total: totalTransactions,
                success: successfulTransactions,
                failed: failedTransactions,
                pending: pendingTransactions,
                today: todayTransactions
            },
            financial: {
                total_amount: totalAmount._sum.amount || 0,
                refunded_amount: refundedAmount._sum.refund_amount || 0,
                net_amount: (totalAmount._sum.amount || 0) - (refundedAmount._sum.refund_amount || 0),
                average_transaction: successfulTransactions > 0 ?
                    (totalAmount._sum.amount || 0) / successfulTransactions : 0
            },
            rates: {
                success_rate: totalTransactions > 0 ?
                    (successfulTransactions / totalTransactions) * 100 : 0,
                refund_rate: (totalAmount._sum.amount || 0) > 0 ?
                    (refundedAmount._sum.refund_amount || 0) / (totalAmount._sum.amount || 0) * 100 : 0
            },
            trends: monthlyTrend,
            breakdown: {
                by_payment_method: await this.getPaymentMethodBreakdown(where),
                by_type: await this.getTransactionTypeBreakdown(where),
                by_status: await this.getStatusBreakdown(where)
            }
        };

        await this.cacheManager.set(cacheKey, stats, 15 * 60 * 1000); // 15 minutes cache
        return stats;
    }

    // ==================== متدهای کمکی ====================
    private generateTransactionNumber(): string {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TXN-${timestamp}-${random}`;
    }

    private canRefundTransaction(transaction: any): boolean {
        return transaction.status === TransactionStatus.SUCCESS &&
            !transaction.refunded_at &&
            transaction.transaction_type === TransactionType.DEBIT &&
            new Date(transaction.completed_at || transaction.created_at) >
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // حداکثر 30 روز
    }

    private canRetryTransaction(transaction: any): boolean {
        return transaction.status === TransactionStatus.FAILED &&
            transaction.payment_method === PaymentMethod.ONLINE_GATEWAY &&
            new Date(transaction.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000); // حداکثر 24 ساعت
    }

    private getPaymentGatewayInfo(transaction: any) {
        if (transaction.payment_method !== PaymentMethod.ONLINE_GATEWAY) {
            return null;
        }

        const gatewayResponse = transaction.gateway_response as any;

        // تشخیص خودکار درگاه
        let detectedGateway = gatewayResponse?.gateway || 'Unknown';
        if (!detectedGateway || detectedGateway === 'Unknown') {
            if (transaction.gateway_reference?.startsWith('A')) {
                detectedGateway = 'RayanPay';
            } else if (transaction.gateway_reference?.length === 36) {
                detectedGateway = 'Zarinpal';
            } else if (transaction.gateway_reference?.startsWith('M')) {
                detectedGateway = 'Mellat';
            }
        }

        return {
            gateway: detectedGateway,
            reference: transaction.gateway_reference,
            tracking_code: gatewayResponse?.tracking_code,
            card_number: gatewayResponse?.card_number,
            transaction_date: gatewayResponse?.verified_at || gatewayResponse?.initiated_at,
            bank_name: gatewayResponse?.bank_name
        };
    }

    private getRefundInfo(transaction: any) {
        if (!transaction.refunded_at) {
            return null;
        }

        return {
            refunded_at: transaction.refunded_at,
            refund_amount: transaction.refund_amount,
            refund_reason: transaction.refund_reason,
            approved_by: transaction.verified_by
        };
    }

    private getTransactionTimeline(transaction: any) {
        const timeline = [];

        timeline.push({
            event: 'created',
            time: transaction.created_at,
            description: 'تراکنش ایجاد شد'
        });

        if (transaction.processed_at) {
            timeline.push({
                event: 'processed',
                time: transaction.processed_at,
                description: 'تراکنش پردازش شد'
            });
        }

        if (transaction.completed_at) {
            timeline.push({
                event: 'completed',
                time: transaction.completed_at,
                description: `تراکنش ${transaction.status === 'SUCCESS' ? 'موفق' : 'ناموفق'} بود`
            });
        }

        if (transaction.verified_at) {
            timeline.push({
                event: 'verified',
                time: transaction.verified_at,
                description: 'تراکنش تأیید شد'
            });
        }

        if (transaction.refunded_at) {
            timeline.push({
                event: 'refunded',
                time: transaction.refunded_at,
                description: 'مبلغ بازپرداخت شد'
            });
        }

        return timeline;
    }

    private getVerificationMethod(transaction: any): string {
        if (transaction.verified_by) {
            return 'MANUAL';
        }
        if (transaction.gateway_response?.verified) {
            return 'GATEWAY';
        }
        return 'NONE';
    }

    private isValidStatusTransition(from: TransactionStatus, to: TransactionStatus): boolean {
        const validTransitions = {
            [TransactionStatus.PENDING]: [
                TransactionStatus.SUCCESS,
                TransactionStatus.FAILED,
                TransactionStatus.PROCESSING
            ],
            [TransactionStatus.PROCESSING]: [
                TransactionStatus.SUCCESS,
                TransactionStatus.FAILED
            ],
            [TransactionStatus.SUCCESS]: [
                TransactionStatus.REFUNDED
            ],
            [TransactionStatus.FAILED]: [
                TransactionStatus.PENDING // امکان تلاش مجدد
            ],
            [TransactionStatus.REFUNDED]: [] // پس از بازپرداخت، تغییر وضعیت مجاز نیست
        };

        return validTransitions[from]?.includes(to) || false;
    }

    private async createCreditTransactionForRefund(transaction: any, adminId: string) {
        // ایجاد تراکنش اعتباری برای بازپرداخت
        const description = `بازپرداخت تراکنش ${transaction.transaction_number} | تأیید شده توسط: ${adminId} | مبلغ: ${transaction.refund_amount || transaction.amount} ریال`;

        await this.prisma.creditTransaction.create({
            data: {
                user_id: transaction.user_id,
                amount: transaction.refund_amount || transaction.amount,
                balance_after: 0, // باید از موجودی کاربر محاسبه شود
                activity_type: 'REFUND',
                description: description,
                credit_transaction_type: TransactionType.CREDIT,
                transaction_id: transaction.id
                // حذف metadata
            }
        });

        // بروزرسانی تراکنش بازپرداخت برای ذخیره اطلاعات اضافی
        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                gateway_response: {
                    ...(transaction.gateway_response as any),
                    credit_transaction_created: true,
                    refund_approved: true,
                    approved_by: adminId,
                    approved_at: new Date().toISOString(),
                    original_transaction: transaction.transaction_number
                }
            }
        });
    }

    private calculateStatusBreakdown(transactions: any[]) {
        const breakdown = {};
        transactions.forEach(transaction => {
            if (!breakdown[transaction.status]) {
                breakdown[transaction.status] = 0;
            }
            breakdown[transaction.status]++;
        });
        return breakdown;
    }

    private calculateSuccessRate(transactions: any[]): number {
        const total = transactions.length;
        const successful = transactions.filter(t => t.status === TransactionStatus.SUCCESS).length;
        return total > 0 ? (successful / total) * 100 : 0;
    }

    private async getMonthlyTransactionTrend(where: Prisma.TransactionWhereInput) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6); // 6 ماه گذشته

        const monthlyData = await this.prisma.transaction.groupBy({
            by: ['created_at'],
            where: {
                ...where,
                created_at: { gte: startDate }
            },
            _count: { id: true },
            _sum: { amount: true },
            orderBy: { created_at: 'asc' }
        });

        return monthlyData.map(month => ({
            month: month.created_at.toISOString().slice(0, 7),
            transactions: month._count.id,
            amount: month._sum.amount || 0
        }));
    }

    private async getPaymentMethodBreakdown(where: Prisma.TransactionWhereInput) {
        const breakdown = await this.prisma.transaction.groupBy({
            by: ['payment_method'],
            where: { ...where, status: TransactionStatus.SUCCESS },
            _count: { id: true },
            _sum: { amount: true }
        });

        return breakdown.map(item => ({
            method: item.payment_method,
            count: item._count.id,
            amount: item._sum.amount || 0
        }));
    }

    private async getTransactionTypeBreakdown(where: Prisma.TransactionWhereInput) {
        const breakdown = await this.prisma.transaction.groupBy({
            by: ['transaction_type'],
            where,
            _count: { id: true },
            _sum: { amount: true }
        });

        return breakdown.map(item => ({
            type: item.transaction_type,
            count: item._count.id,
            amount: item._sum.amount || 0
        }));
    }

    private async getStatusBreakdown(where: Prisma.TransactionWhereInput) {
        const breakdown = await this.prisma.transaction.groupBy({
            by: ['status'],
            where,
            _count: { id: true }
        });

        return breakdown.map(item => ({
            status: item.status,
            count: item._count.id
        }));
    }

    // ==================== غنی‌سازی با محتوای چندزبانه ====================
    private enrichTransactionWithContent(transaction: any, language: Language) {
        if (!transaction) return transaction;

        // غنی‌سازی اطلاعات کاربر
        if (transaction.user) {
            const userContent = transaction.user.contents?.[0];
            transaction.user = {
                ...transaction.user,
                first_name: userContent?.first_name,
                last_name: userContent?.last_name,
                display_name: this.getUserDisplayName(transaction.user, userContent)
            };
        }

        // غنی‌سازی اطلاعات سفارش
        if (transaction.order) {
            const orderContent = transaction.order.contents?.[0];
            transaction.order = {
                ...transaction.order,
                display_name: orderContent?.name || `سفارش ${transaction.order.order_number}`
            };

            // غنی‌سازی اطلاعات فروشنده اگر وجود دارد
            if (transaction.order.seller) {
                const sellerContent = transaction.order.seller.contents?.[0];
                transaction.order.seller = {
                    ...transaction.order.seller,
                    first_name: sellerContent?.first_name,
                    last_name: sellerContent?.last_name,
                    display_name: this.getUserDisplayName(transaction.order.seller, sellerContent)
                };
            }
        }

        return transaction;
    }

    private getUserDisplayName(user: any, content: any): string {
        if (content?.first_name && content?.last_name) {
            return `${content.first_name} ${content.last_name}`;
        }
        return user.user_name || 'کاربر';
    }

    // ==================== مدیریت کش ====================
    private async clearTransactionCaches(userId: string, orderId: string): Promise<void> {
        const patterns = [
            `user_transactions:${userId}:*`,
            `transaction:${orderId}:*`,
            'transaction_stats:*',
            `order:${orderId}:*`,
            `user_orders:${userId}:*`
        ];

        for (const pattern of patterns) {
            await this.clearPatternKeys(pattern);
        }
    }

    private async clearPatternKeys(pattern: string): Promise<void> {
        try {
            const keys = await this.getAllKeysByPattern(pattern);
            if (keys.length > 0) {
                await Promise.all(keys.map(key => this.cacheManager.del(key)));
            }
        } catch (error) {
            console.warn(`Could not clear pattern ${pattern}:`, error.message);
        }
    }

    private async getAllKeysByPattern(pattern: string): Promise<string[]> {
        // پیاده‌سازی مدیریت کش (مشابه سرویس سفارشات)
        try {
            const cacheStore = (this.cacheManager as any).store;

            if (cacheStore?.getClient) {
                const redisClient = cacheStore.getClient();
                if (redisClient?.keys) {
                    return new Promise((resolve) => {
                        redisClient.keys(pattern, (err: any, keys: string[]) => {
                            resolve(err ? [] : keys || []);
                        });
                    });
                }
            }

            return [];
        } catch (error) {
            console.warn('Error in getAllKeysByPattern:', error);
            return [];
        }
    }

}

// ادامه متدها در پاسخ بعدی...