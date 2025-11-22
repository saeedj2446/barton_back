// src/services/order/order.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
    OrderStatus,
    OrderType,
    PaymentMethod,
    TransactionStatus,
    TransactionType,
    Prisma,
    Language,
    ProductStatus
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// ابتدا تایپ SellerItems رو اصلاح کنید
interface SellerInfo {
    id: string;
    user_name?: string;
    first_name?: string;
    last_name?: string;
    account_name?: string; // اضافه کردن این فیلد
}

interface SellerItems {
    seller: SellerInfo;
    items: any[];
}

interface ItemsBySeller {
    [sellerId: string]: SellerItems;
}




@Injectable()
export class OrderService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    private readonly DEFAULT_LANGUAGE = Language.fa;

    // ==================== ایجاد سفارش جدید ====================
    async create(createOrderDto: CreateOrderDto, userId: string) {
        const { items, account_id, ...orderData } = createOrderDto;

        await this.validateOrderItems(items);
        const itemsBySeller = await this.groupItemsBySeller(items);

        return await this.prisma.$transaction(async (tx) => {
            await this.updateProductStock(items, tx);

            const orders = [];
            let totalMainAmount = 0;
            let totalMainTax = 0;
            let totalMainDiscount = 0;
            let totalMainNet = 0;

            for (const [sellerId, sellerData] of Object.entries(itemsBySeller)) {
                const sellerItems = (sellerData as SellerItems).items;
                const orderNumber = await this.generateOrderNumber();

                // محاسبات مالی برای هر سفارش فروشنده
                const financials = await this.calculateOrderFinancials(sellerItems, userId);

                // جمع‌آوری مقادیر برای سفارش اصلی
                totalMainAmount += financials.total_amount;
                totalMainTax += financials.tax_amount;
                totalMainDiscount += financials.discount_amount;
                totalMainNet += financials.net_amount;

                // ایجاد سفارش برای هر فروشنده
                const order = await tx.order.create({
                    data: {
                        ...orderData,
                        order_number: orderNumber,
                        user_id: userId,
                        account_id: account_id,
                        seller_id: sellerId,
                        ...financials,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        metadata: {
                            is_split_order: true,
                            parent_order_id: null,
                            seller_specific: true
                        },
                        items: {
                            create: await Promise.all(sellerItems.map(async (item) => {
                                const productContent = await this.getProductContent(item.product_id, this.DEFAULT_LANGUAGE);
                                return {
                                    item_type: 'PRODUCT',
                                    item_id: item.product_id,
                                    item_title: productContent?.name || `محصول ${item.product_id}`,
                                    quantity: item.quantity,
                                    unit_price: item.unit_price,
                                    total_price: item.quantity * item.unit_price,
                                    product_id: item.product_id,
                                    description: item.description || null
                                };
                            }))
                        }
                    },
                    include: {
                        items: {
                            include: {
                                product: {
                                    include: {
                                        contents: {
                                            where: { language: this.DEFAULT_LANGUAGE },
                                            take: 1
                                        },
                                        account: {
                                            select: {
                                                id: true,
                                                activity_type: true,
                                                contents: {
                                                    where: { language: this.DEFAULT_LANGUAGE },
                                                    select: {
                                                        name: true,
                                                        company_name: true
                                                    },
                                                    take: 1
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        seller: {
                            select: {
                                id: true,
                                user_name: true,
                                contents: {
                                    where: { language: this.DEFAULT_LANGUAGE },
                                    select: { first_name: true, last_name: true },
                                    take: 1
                                }
                            }
                        }
                    }
                });

                orders.push(this.enrichOrderWithContent(order, this.DEFAULT_LANGUAGE));
            }

            // ایجاد یک سفارش اصلی برای پیگیری کلی
            const mainOrderNumber = await this.generateOrderNumber();
            const mainOrder = await tx.order.create({
                data: {
                    order_number: mainOrderNumber,
                    order_type: OrderType.PRODUCT_PURCHASE,
                    status: OrderStatus.PENDING,
                    user_id: userId,
                    account_id: account_id,
                    total_amount: totalMainAmount,
                    tax_amount: totalMainTax,
                    discount_amount: totalMainDiscount,
                    net_amount: totalMainNet,
                    metadata: {
                        is_main_order: true,
                        child_orders: orders.map(order => order.id),
                        total_sellers: orders.length
                    }
                }
            });

            // آپدیت سفارشات فرزند با parent_order_id
            for (const order of orders) {
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        metadata: {
                            ...(order.metadata as any),
                            parent_order_id: mainOrder.id
                        }
                    }
                });
            }

            await this.clearOrderCaches(userId, account_id);

            return {
                main_order: mainOrder,
                seller_orders: orders,
                summary: {
                    total_orders: orders.length,
                    total_amount: mainOrder.total_amount,
                    total_sellers: orders.length
                }
            };
        });
    }

    // ==================== گروه‌بندی آیتم‌ها بر اساس فروشنده ====================
    private async groupItemsBySeller(items: any[]): Promise<ItemsBySeller> {
        const productIds = items.map(item => item.product_id);

        // پیدا کردن تمام محصولات و اکانت‌های مرتبط
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: productIds }
            },
            select: {
                id: true,
                account: {
                    select: {
                        id: true,
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { name: true, company_name: true },
                            take: 1
                        }
                    }
                }
            }
        });

        // پیدا کردن مالکین اکانت‌ها
        const accountIds = products.map(p => p.account.id);
        const accountOwners = await this.prisma.accountUser.findMany({
            where: {
                account_id: { in: accountIds },
                account_role: 'OWNER'
            },
            select: {
                account_id: true,
                user_id: true,
                user: {
                    select: {
                        id: true,
                        user_name: true,
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { first_name: true, last_name: true },
                            take: 1
                        }
                    }
                }
            }
        });

        // ایجاد map برای دسترسی سریع
        const accountOwnerMap = new Map();
        accountOwners.forEach(owner => {
            accountOwnerMap.set(owner.account_id, owner);
        });

        const productMap = new Map();
        products.forEach(product => {
            productMap.set(product.id, product);
        });

        // گروه‌بندی آیتم‌ها بر اساس فروشنده
        const itemsBySeller: ItemsBySeller = {};

        for (const item of items) {
            const product = productMap.get(item.product_id);
            if (!product) continue;

            const accountOwner = accountOwnerMap.get(product.account.id);
            if (!accountOwner) continue;

            const sellerId = accountOwner.user_id;
            const sellerContent = accountOwner.user.contents[0];
            const accountContent = product.account.contents[0];

            if (!itemsBySeller[sellerId]) {
                itemsBySeller[sellerId] = {
                    seller: {
                        id: accountOwner.user.id,
                        user_name: accountOwner.user.user_name,
                        first_name: sellerContent?.first_name,
                        last_name: sellerContent?.last_name,
                        account_name: accountContent?.name || accountContent?.company_name
                    },
                    items: []
                };
            }

            itemsBySeller[sellerId].items.push(item);
        }

        return itemsBySeller;
    }

    // ==================== اعتبارسنجی آیتم‌های سفارش ====================
    private async validateOrderItems(items: any[]) {
        for (const item of items) {
            const product = await this.prisma.product.findUnique({
                where: {
                    id: item.product_id,
                    status: ProductStatus.APPROVED,
                    confirmed: true
                },
                include: {
                    account: {
                        select: {
                            id: true,
                            is_active: true,
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                select: {
                                    name: true,
                                    company_name: true
                                },
                                take: 1
                            }
                        }
                    },
                    contents: {
                        where: { language: this.DEFAULT_LANGUAGE },
                        select: { name: true },
                        take: 1
                    },
                    pricing_strategies: {
                        where: { is_active: true, is_primary: true },
                        take: 1
                    }
                }
            });

            if (!product) {
                throw new NotFoundException(`محصول با شناسه ${item.product_id} یافت نشد یا غیرفعال است`);
            }

            if (!product.account.is_active) {
                const accountContent = product.account.contents[0];
                const accountName = accountContent?.name || accountContent?.company_name;
                throw new BadRequestException(`اکانت فروشنده ${accountName} غیرفعال است`);
            }

            if (product.stock < item.quantity) {
                const productName = product.contents[0]?.name;
                throw new BadRequestException(
                    `موجودی محصول ${productName} کافی نیست. موجودی: ${product.stock}، درخواستی: ${item.quantity}`
                );
            }

            if (item.quantity < product.min_sale_amount) {
                const productName = product.contents[0]?.name;
                throw new BadRequestException(
                    `حداقل مقدار خرید برای محصول ${productName}: ${product.min_sale_amount}`
                );
            }

            // استفاده از قیمت پایه محصول
            const basePrice = product.base_min_price || 0;

            if (item.unit_price < basePrice) {
                const productName = product.contents[0]?.name;
                throw new BadRequestException(
                    `قیمت محصول ${productName} نمی‌تواند کمتر از ${basePrice.toLocaleString()} ریال باشد`
                );
            }
        }
    }

    // ==================== محاسبات مالی سفارش ====================
    private async calculateOrderFinancials(items: any[], userId: string) {
        let totalAmount = 0;

        for (const item of items) {
            totalAmount += item.quantity * item.unit_price;
        }

        // محاسبات مالی
        const taxAmount = Math.round(totalAmount * 0.09); // 9% مالیات
        const discountAmount = await this.calculateUserDiscount(userId, totalAmount);
        const netAmount = totalAmount + taxAmount - discountAmount;

        return {
            total_amount: totalAmount,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            net_amount: netAmount,
        };
    }

    private async calculateUserDiscount(userId: string, totalAmount: number): Promise<number> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { credit_level: true, total_spent: true }
        });

        let discount = 0;

        if (user?.credit_level >= 3) {
            discount = Math.round(totalAmount * 0.05);
        } else if (user?.total_spent > 10000000) {
            discount = Math.round(totalAmount * 0.03);
        }

        return discount;
    }

    // ==================== دریافت محتوای محصول ====================
    private async getProductContent(productId: string, language: Language) {
        const content = await this.prisma.productContent.findFirst({
            where: {
                product_id: productId,
                language: language
            }
        });
        return content;
    }

    // ==================== غنی‌سازی سفارش با محتوای چندزبانه ====================
    private enrichOrderWithContent(order: any, language: Language) {
        if (!order) return order;

        // غنی‌سازی اطلاعات فروشنده
        if (order.seller) {
            const sellerContent = order.seller.contents?.[0];
            order.seller = {
                ...order.seller,
                first_name: sellerContent?.first_name,
                last_name: sellerContent?.last_name,
                display_name: this.getUserDisplayName(order.seller, sellerContent)
            };
        }

        // غنی‌سازی اطلاعات محصولات
        if (order.items) {
            order.items = order.items.map(item => {
                const productContent = item.product?.contents?.[0];
                return {
                    ...item,
                    product: item.product ? {
                        ...item.product,
                        name: productContent?.name || item.product.base_name,
                        account: item.product.account ? {
                            ...item.product.account,
                            name: item.product.account.contents?.[0]?.name || item.product.account.name
                        } : null
                    } : null
                };
            });
        }

        return order;
    }

    private getUserDisplayName(user: any, content: any): string {
        if (content?.first_name && content?.last_name) {
            return `${content.first_name} ${content.last_name}`;
        }
        return user.user_name || 'کاربر';
    }

    // ==================== تولید شماره سفارش ====================
    private async generateOrderNumber(): Promise<string> {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ORD-${timestamp}-${random}`;
    }

    // ==================== بروزرسانی موجودی محصولات ====================
    private async updateProductStock(items: any[], tx: Prisma.TransactionClient) {
        for (const item of items) {
            await tx.product.update({
                where: { id: item.product_id },
                data: {
                    stock: { decrement: item.quantity },
                    ...(item.quantity > 0 && {
                        status: ProductStatus.APPROVED
                    })
                }
            });
        }
    }

    // ==================== دریافت سفارشات کاربر ====================
    async findAllByUser(query: OrderQueryDto, userId: string) {
        const cacheKey = `user_orders:${userId}:${JSON.stringify(query)}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 10, status, order_type, account_id, search } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.OrderWhereInput = { user_id: userId };

        if (status) where.status = status;
        if (order_type) where.order_type = order_type;
        if (account_id) where.account_id = account_id;

        if (search) {
            where.OR = [
                { order_number: { contains: search, mode: 'insensitive' } },
                {
                    items: {
                        some: {
                            OR: [
                                { item_title: { contains: search, mode: 'insensitive' } },
                                {
                                    product: {
                                        contents: {
                                            some: {
                                                name: { contains: search, mode: 'insensitive' }
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            ];
        }

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                include: {
                    items: {
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
                    },
                    seller: {
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
                    },
                    _count: {
                        select: {
                            items: true,
                            transactions: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        // غنی‌سازی سفارشات با محتوای چندزبانه
        const enrichedOrders = orders.map(order =>
            this.enrichOrderWithContent(order, this.DEFAULT_LANGUAGE)
        );

        // اضافه کردن اطلاعات خلاصه
        const ordersWithSummary = enrichedOrders.map(order => ({
            ...order,
            summary: {
                total_items: order.items.length,
                total_unique_products: new Set(order.items.map(item => item.product_id)).size,
                seller_info: order.seller ? {
                    id: order.seller.id,
                    name: this.getUserDisplayName(order.seller, order.seller.contents?.[0]),
                    user_name: order.seller.user_name
                } : null,
                can_cancel: order.status === OrderStatus.PENDING,
                can_pay: order.status === OrderStatus.PENDING && !order.paid_at,
            }
        }));

        const result = {
            data: ordersWithSummary,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                summary: {
                    total_orders: total,
                    total_amount: orders.reduce((sum, order) => sum + order.total_amount, 0),
                    total_sellers: new Set(orders.map(order => order.seller?.id).filter(Boolean)).size
                }
            },
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    // ==================== دریافت جزئیات سفارش ====================
    async findOne(id: string, userId: string) {
        const cacheKey = `order:${id}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
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
                },
                seller: {
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
                },
                transactions: {
                    orderBy: { created_at: 'desc' },
                    take: 5,
                    include: {
                        credit_transaction: {
                            select: {
                                amount: true,
                                balance_after: true
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            throw new NotFoundException('سفارش یافت نشد');
        }

        // بررسی دسترسی
        if (order.user_id !== userId) {
            throw new ForbiddenException('دسترسی به این سفارش ندارید');
        }

        // غنی‌سازی با محتوای چندزبانه
        const enrichedOrder = this.enrichOrderWithContent(order, this.DEFAULT_LANGUAGE);

        // گروه‌بندی آیتم‌ها بر اساس فروشنده
        const itemsBySeller = this.groupOrderItemsBySeller(enrichedOrder.items);

        const orderWithStats = {
            ...enrichedOrder,
            summary: {
                total_items: enrichedOrder.items.length,
                total_sellers: Object.keys(itemsBySeller).length,
                total_unique_products: new Set(enrichedOrder.items.map(item => item.product_id)).size,
                can_cancel: enrichedOrder.status === OrderStatus.PENDING,
                can_pay: enrichedOrder.status === OrderStatus.PENDING && !enrichedOrder.paid_at,
                items_by_seller: itemsBySeller
            },
            seller_info: enrichedOrder.seller ? {
                ...enrichedOrder.seller,
                display_name: this.getUserDisplayName(enrichedOrder.seller, enrichedOrder.seller.contents?.[0])
            } : null
        };

        await this.cacheManager.set(cacheKey, orderWithStats, this.CACHE_TTL);
        return orderWithStats;
    }

    private groupOrderItemsBySeller(items: any[]) {
        const sellerMap = new Map();

        items.forEach(item => {
            const sellerAccount = item.product?.account;
            if (!sellerAccount) return;

            if (!sellerMap.has(sellerAccount.id)) {
                sellerMap.set(sellerAccount.id, {
                    seller_account: {
                        ...sellerAccount,
                        name: sellerAccount.contents?.[0]?.name || sellerAccount.name
                    },
                    items: [],
                    total_amount: 0
                });
            }

            const sellerData = sellerMap.get(sellerAccount.id);
            sellerData.items.push(item);
            sellerData.total_amount += item.total_price;
        });

        return Array.from(sellerMap.values());
    }

    // ==================== لغو سفارش ====================
    async cancelOrder(id: string, userId: string, reason?: string) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!order) {
            throw new NotFoundException('سفارش یافت نشد');
        }

        if (order.user_id !== userId) {
            throw new ForbiddenException('شما اجازه لغو این سفارش را ندارید');
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('فقط سفارشات در انتظار پرداخت قابل لغو هستند');
        }

        return await this.prisma.$transaction(async (tx) => {
            // برگشت موجودی محصولات
            for (const item of order.items) {
                if (item.product_id) {
                    await tx.product.update({
                        where: { id: item.product_id },
                        data: {
                            stock: { increment: item.quantity }
                        }
                    });
                }
            }

            // بروزرسانی وضعیت سفارش
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    status: OrderStatus.CANCELLED,
                    ...(reason && {
                        metadata: {
                            ...(order.metadata as any),
                            cancellation_reason: reason,
                            cancelled_at: new Date().toISOString()
                        }
                    })
                },
                include: {
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

            await this.clearOrderCaches(userId, order.account_id);
            return this.enrichOrderWithContent(updatedOrder, this.DEFAULT_LANGUAGE);
        });
    }

    // ==================== تغییر وضعیت سفارش (ادمین) ====================
    async updateOrderStatus(orderId: string, status: OrderStatus, adminId: string, reason?: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            throw new NotFoundException('سفارش یافت نشد');
        }

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                ...(reason && {
                    metadata: {
                        ...(order.metadata as any),
                        status_change_reason: reason,
                        status_changed_by: adminId,
                        status_changed_at: new Date().toISOString()
                    }
                })
            },
            include: {
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

        await this.clearOrderCaches(order.user_id, order.account_id);
        return this.enrichOrderWithContent(updatedOrder, this.DEFAULT_LANGUAGE);
    }

    // ==================== مدیریت کش ====================
    private async clearOrderCaches(userId: string, accountId: string): Promise<void> {
        const patterns = [
            `user_orders:${userId}:*`,
            `order:${accountId}:*`,
            'order_stats:*'
        ];

        for (const pattern of patterns) {
            await this.clearPatternKeys(pattern);
        }
    }

    private async clearPatternKeys(pattern: string): Promise<void> {
        try {
            // پیاده‌سازی ساده پاک کردن کش - در محیط production باید بهبود یابد
            const keys = await this.getAllKeysByPattern(pattern);
            await Promise.all(keys.map(key => this.cacheManager.del(key)));
        } catch (error) {
            console.warn(`Could not clear pattern ${pattern}:`, error.message);
        }
    }

    // ==================== مدیریت پیشرفته کش ====================
    private async getAllKeysByPattern(pattern: string): Promise<string[]> {
        try {
            // ساده‌ترین و مؤثرترین روش
            const cacheStore = (this.cacheManager as any).store;

            // اگر redis هست
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

            // اگر memory cache هست
            if (typeof cacheStore?.keys === 'function') {
                const allKeys = await cacheStore.keys();
                return allKeys.filter((key: string) =>
                    key.includes(pattern.replace(/\*/g, ''))
                );
            }

            // Fallback برای محیط توسعه
            return this.getFallbackKeys(pattern);

        } catch (error) {
            console.warn('Cache pattern matching failed, using fallback:', error);
            return this.getFallbackKeys(pattern);
        }
    }

    private getFallbackKeys(pattern: string): string[] {
        // لیست کلیدهای مهم بر اساس پترن
        const keyMap: { [key: string]: string[] } = {
            'user_orders:*': ['user_orders:list', 'user_orders:stats'],
            'seller_orders:*': ['seller_orders:list', 'seller_orders:stats'],
            'order:*': ['order:detail', 'order:items'],
            'order_stats:*': ['order_stats:summary']
        };

        return keyMap[pattern] || [];
    }

// ==================== دریافت سفارشات فروشنده ====================
    async findSellerOrders(query: OrderQueryDto, sellerId: string) {
        const cacheKey = `seller_orders:${sellerId}:${JSON.stringify(query)}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 10, status, order_type, search } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.OrderWhereInput = {
            seller_id: sellerId,
            order_type: OrderType.PRODUCT_PURCHASE
        };

        if (status) where.status = status;
        if (order_type) where.order_type = order_type;

        if (search) {
            where.OR = [
                { order_number: { contains: search, mode: 'insensitive' } },
                {
                    items: {
                        some: {
                            OR: [
                                { item_title: { contains: search, mode: 'insensitive' } },
                                {
                                    product: {
                                        contents: {
                                            some: {
                                                name: { contains: search, mode: 'insensitive' }
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    user: {
                        OR: [
                            { user_name: { contains: search, mode: 'insensitive' } },
                            {
                                contents: {
                                    some: {
                                        OR: [
                                            { first_name: { contains: search, mode: 'insensitive' } },
                                            { last_name: { contains: search, mode: 'insensitive' } }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                }
            ];
        }

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                include: {
                    items: {
                        include: {
                            product: {
                                include: {
                                    contents: {
                                        where: { language: this.DEFAULT_LANGUAGE },
                                        take: 1
                                    },
                                    pricing_strategies: {
                                        where: { is_active: true, is_primary: true },
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
                    },
                    account: {
                        include: {
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                take: 1
                            }
                        }
                    },
                    transactions: {
                        where: { status: 'SUCCESS' },
                        take: 1,
                        orderBy: { created_at: 'desc' },
                        select: {
                            id: true,
                            amount: true,
                            payment_method: true,
                            completed_at: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        // غنی‌سازی سفارشات با محتوای چندزبانه
        const enrichedOrders = orders.map(order => this.enrichOrderWithContent(order, this.DEFAULT_LANGUAGE));

        const result = {
            data: enrichedOrders,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                summary: {
                    total_orders: total,
                    total_amount: orders.reduce((sum, order) => sum + order.total_amount, 0),
                    total_items: orders.reduce((sum, order) => sum + order.items.length, 0),
                    status_breakdown: this.calculateStatusBreakdown(orders)
                }
            },
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

// ==================== تغییر وضعیت سفارش توسط فروشنده ====================
    async updateOrderStatusBySeller(orderId: string, status: OrderStatus, sellerId: string, reason?: string) {
        const order = await this.prisma.order.findUnique({
            where: {
                id: orderId,
                seller_id: sellerId // فقط سفارشات خود فروشنده
            },
            include: {
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
            throw new NotFoundException('سفارش یافت نشد یا شما دسترسی ندارید');
        }

        // بررسی انتقال وضعیت مجاز
        const validStatusTransitions = {
            [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
            [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            [OrderStatus.COMPLETED]: [], // پس از تکمیل، تغییر وضعیت مجاز نیست
            [OrderStatus.CANCELLED]: [], // پس از لغو، تغییر وضعیت مجاز نیست
            [OrderStatus.PAID]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED]
        };

        const allowedStatuses = validStatusTransitions[order.status] || [];
        if (!allowedStatuses.includes(status)) {
            throw new BadRequestException(
                `تغییر وضعیت از ${order.status} به ${status} مجاز نیست. وضعیت‌های مجاز: ${allowedStatuses.join(', ')}`
            );
        }

        // برای وضعیت تکمیل شده، بررسی موجودی محصولات
        if (status === OrderStatus.COMPLETED) {
            for (const item of order.items) {
                if (item.product_id && item.quantity > (item.product?.stock || 0)) {
                    const productName = item.product?.contents?.[0]?.name;
                    throw new BadRequestException(
                        `موجودی محصول ${productName} برای تکمیل سفارش کافی نیست`
                    );
                }
            }
        }

        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                ...(reason && {
                    metadata: {
                        ...(order.metadata as any),
                        status_update_reason: reason,
                        status_updated_by_seller: sellerId,
                        status_updated_at: new Date().toISOString()
                    }
                }),
                // اگر وضعیت به "تکمیل شده" تغییر کرد، تاریخ تکمیل را ثبت کن
                ...(status === OrderStatus.COMPLETED && {
                    metadata: {
                        ...(order.metadata as any),
                        completed_at: new Date().toISOString(),
                        completed_by_seller: sellerId
                    }
                })
            },
            include: {
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

        // اگر وضعیت به "تکمیل شده" تغییر کرد، موجودی محصولات را کاهش بده
        if (status === OrderStatus.COMPLETED) {
            for (const item of order.items) {
                if (item.product_id) {
                    await this.prisma.product.update({
                        where: { id: item.product_id },
                        data: {
                            stock: { decrement: item.quantity }
                        }
                    });
                }
            }
        }

        await this.clearOrderCaches(order.user_id, order.account_id);
        await this.clearPatternKeys(`seller_orders:${sellerId}:*`);

        return this.enrichOrderWithContent(updatedOrder, this.DEFAULT_LANGUAGE);
    }

// ==================== دریافت سفارشات گروه‌بندی شده بر اساس فروشنده ====================
    async findUserOrdersGroupedBySeller(query: OrderQueryDto, userId: string) {
        const cacheKey = `user_orders_grouped:${userId}:${JSON.stringify(query)}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 20, status, order_type, account_id } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.OrderWhereInput = { user_id: userId };

        if (status) where.status = status;
        if (order_type) where.order_type = order_type;
        if (account_id) where.account_id = account_id;

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                include: {
                    items: {
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
                    },
                    seller: {
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
                    },
                    transactions: {
                        where: { status: 'SUCCESS' },
                        take: 1,
                        orderBy: { created_at: 'desc' },
                        select: {
                            id: true,
                            amount: true,
                            payment_method: true,
                            completed_at: true
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        // گروه‌بندی سفارشات بر اساس فروشنده
        const groupedOrders = this.groupOrdersBySeller(orders);

        const result = {
            data: groupedOrders,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                summary: {
                    total_orders: orders.length,
                    total_sellers: groupedOrders.length,
                    total_amount: orders.reduce((sum, order) => sum + order.total_amount, 0),
                    status_breakdown: this.calculateStatusBreakdown(orders)
                }
            },
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

// ==================== گروه‌بندی سفارشات بر اساس فروشنده ====================
    private groupOrdersBySeller(orders: any[]) {
        const sellerMap = new Map();

        orders.forEach(order => {
            const seller = order.seller;
            if (!seller) return;

            const sellerContent = seller.contents?.[0];
            const sellerKey = seller.id;

            if (!sellerMap.has(sellerKey)) {
                sellerMap.set(sellerKey, {
                    seller: {
                        ...seller,
                        first_name: sellerContent?.first_name,
                        last_name: sellerContent?.last_name,
                        display_name: this.getUserDisplayName(seller, sellerContent)
                    },
                    orders: [],
                    total_amount: 0,
                    total_items: 0,
                    status_summary: {},
                    latest_order_date: order.created_at
                });
            }

            const sellerData = sellerMap.get(sellerKey);
            sellerData.orders.push({
                ...order,
                payment_info: order.transactions[0] || null
            });
            sellerData.total_amount += order.total_amount;
            sellerData.total_items += order.items.length;

            // به‌روزرسانی تاریخ آخرین سفارش
            if (order.created_at > sellerData.latest_order_date) {
                sellerData.latest_order_date = order.created_at;
            }

            // جمع‌آوری آمار وضعیت
            if (!sellerData.status_summary[order.status]) {
                sellerData.status_summary[order.status] = 0;
            }
            sellerData.status_summary[order.status]++;
        });

        // مرتب‌سازی بر اساس آخرین سفارش
        return Array.from(sellerMap.values()).sort((a, b) =>
            new Date(b.latest_order_date).getTime() - new Date(a.latest_order_date).getTime()
        );
    }

// ==================== محاسبه آمار وضعیت‌ها ====================
    private calculateStatusBreakdown(orders: any[]) {
        const breakdown = {};
        orders.forEach(order => {
            if (!breakdown[order.status]) {
                breakdown[order.status] = 0;
            }
            breakdown[order.status]++;
        });
        return breakdown;
    }

// ==================== دریافت سفارشات برای ادمین ====================
    async findAllAdmin(query: OrderQueryDto) {
        const cacheKey = `admin_orders:${JSON.stringify(query)}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { page = 1, limit = 10, status, order_type, account_id, search } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.OrderWhereInput = {};

        if (status) where.status = status;
        if (order_type) where.order_type = order_type;
        if (account_id) where.account_id = account_id;

        if (search) {
            where.OR = [
                { order_number: { contains: search, mode: 'insensitive' } },
                {
                    items: {
                        some: {
                            OR: [
                                { item_title: { contains: search, mode: 'insensitive' } },
                                {
                                    product: {
                                        contents: {
                                            some: {
                                                name: { contains: search, mode: 'insensitive' }
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    user: {
                        OR: [
                            { user_name: { contains: search, mode: 'insensitive' } },
                            {
                                contents: {
                                    some: {
                                        OR: [
                                            { first_name: { contains: search, mode: 'insensitive' } },
                                            { last_name: { contains: search, mode: 'insensitive' } }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                },
                {
                    seller: {
                        OR: [
                            { user_name: { contains: search, mode: 'insensitive' } },
                            {
                                contents: {
                                    some: {
                                        OR: [
                                            { first_name: { contains: search, mode: 'insensitive' } },
                                            { last_name: { contains: search, mode: 'insensitive' } }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                }
            ];
        }

        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                include: {
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
                    },
                    user: {
                        include: {
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                take: 1
                            }
                        }
                    },
                    seller: {
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
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        // غنی‌سازی سفارشات با محتوای چندزبانه
        const enrichedOrders = orders.map(order => this.enrichOrderWithContent(order, this.DEFAULT_LANGUAGE));

        const result = {
            data: enrichedOrders,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                summary: {
                    total_orders: total,
                    total_amount: orders.reduce((sum, order) => sum + order.total_amount, 0),
                    status_breakdown: this.calculateStatusBreakdown(orders)
                }
            },
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

// ==================== دریافت جزئیات سفارش برای ادمین ====================
    async findOneAdmin(id: string) {
        const cacheKey = `admin_order:${id}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
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
                },
                seller: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
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
                },
                account: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                },
                transactions: {
                    orderBy: { created_at: 'desc' },
                    include: {
                        credit_transaction: {
                            select: {
                                amount: true,
                                balance_after: true
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            throw new NotFoundException('سفارش یافت نشد');
        }

        // غنی‌سازی با محتوای چندزبانه
        const enrichedOrder = this.enrichOrderWithContent(order, this.DEFAULT_LANGUAGE);

        // گروه‌بندی آیتم‌ها بر اساس فروشنده
        const itemsBySeller = this.groupOrderItemsBySeller(enrichedOrder.items);

        const orderWithStats = {
            ...enrichedOrder,
            summary: {
                total_items: enrichedOrder.items.length,
                total_sellers: Object.keys(itemsBySeller).length,
                total_unique_products: new Set(enrichedOrder.items.map(item => item.product_id)).size,
                items_by_seller: itemsBySeller
            }
        };

        await this.cacheManager.set(cacheKey, orderWithStats, this.CACHE_TTL);
        return orderWithStats;
    }

    // در فایل order.service.ts - اضافه کردن متدهای جدید

// ==================== دریافت آمار سفارشات کاربر ====================
    async getUserOrderStats(userId: string) {
        const cacheKey = `user_order_stats:${userId}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const [
            totalOrders,
            pendingOrders,
            completedOrders,
            cancelledOrders,
            totalSpent,
            favoriteSellers
        ] = await Promise.all([
            // تعداد کل سفارشات
            this.prisma.order.count({
                where: { user_id: userId }
            }),

            // سفارشات در انتظار
            this.prisma.order.count({
                where: {
                    user_id: userId,
                    status: { in: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] }
                }
            }),

            // سفارشات تکمیل شده
            this.prisma.order.count({
                where: {
                    user_id: userId,
                    status: OrderStatus.COMPLETED
                }
            }),

            // سفارشات لغو شده
            this.prisma.order.count({
                where: {
                    user_id: userId,
                    status: OrderStatus.CANCELLED
                }
            }),

            // مجموع هزینه‌ها
            this.prisma.order.aggregate({
                where: {
                    user_id: userId,
                    status: OrderStatus.COMPLETED
                },
                _sum: { total_amount: true }
            }),

            // فروشندگان مورد علاقه
            this.prisma.order.groupBy({
                by: ['seller_id'],
                where: {
                    user_id: userId,
                    status: OrderStatus.COMPLETED
                },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5
            })
        ]);

        // اطلاعات فروشندگان
        const sellerDetails = await Promise.all(
            favoriteSellers.map(async (seller) => {
                if (!seller.seller_id) return null;

                const sellerInfo = await this.prisma.user.findUnique({
                    where: { id: seller.seller_id },
                    select: {
                        id: true,
                        user_name: true,
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { first_name: true, last_name: true },
                            take: 1
                        }
                    }
                });

                return sellerInfo ? {
                    id: sellerInfo.id,
                    name: this.getUserDisplayName(sellerInfo, sellerInfo.contents[0]),
                    order_count: seller._count.id
                } : null;
            })
        );

        const stats = {
            overview: {
                total_orders: totalOrders,
                pending_orders: pendingOrders,
                completed_orders: completedOrders,
                cancelled_orders: cancelledOrders,
                total_spent: totalSpent._sum.total_amount || 0,
                completion_rate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
            },
            recent_activity: {
                last_order_date: await this.getLastOrderDate(userId),
                favorite_sellers: sellerDetails.filter(Boolean),
                average_order_value: await this.calculateAverageOrderValue(userId)
            },
            monthly_stats: await this.getMonthlyStats(userId)
        };

        await this.cacheManager.set(cacheKey, stats, 5 * 60 * 1000); // 5 minutes cache
        return stats;
    }

// ==================== دریافت آمار ادمین ====================
    async getAdminOrderStats() {
        const cacheKey = 'admin_order_stats';

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const [
            totalOrders,
            todayOrders,
            pendingOrders,
            completedOrders,
            totalRevenue,
            topSellers,
            recentOrders
        ] = await Promise.all([
            // آمار کلی
            this.prisma.order.count(),
            this.prisma.order.count({
                where: {
                    created_at: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),
            this.prisma.order.count({
                where: {
                    status: { in: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] }
                }
            }),
            this.prisma.order.count({
                where: { status: OrderStatus.COMPLETED }
            }),
            this.prisma.order.aggregate({
                where: { status: OrderStatus.COMPLETED },
                _sum: { total_amount: true }
            }),

            // برترین فروشندگان
            this.prisma.order.groupBy({
                by: ['seller_id'],
                where: { status: OrderStatus.COMPLETED },
                _count: { id: true },
                _sum: { total_amount: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10
            }),

            // سفارشات اخیر
            this.prisma.order.findMany({
                where: {
                    status: { in: [OrderStatus.PENDING, OrderStatus.PAID] }
                },
                include: {
                    user: {
                        include: {
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                take: 1
                            }
                        }
                    },
                    seller: {
                        include: {
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                take: 1
                            }
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: 10
            })
        ]);

        // اطلاعات فروشندگان برتر
        const topSellersDetails = await Promise.all(
            topSellers.map(async (seller) => {
                if (!seller.seller_id) return null;

                const sellerInfo = await this.prisma.user.findUnique({
                    where: { id: seller.seller_id },
                    select: {
                        id: true,
                        user_name: true,
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { first_name: true, last_name: true },
                            take: 1
                        }
                    }
                });

                return sellerInfo ? {
                    id: sellerInfo.id,
                    name: this.getUserDisplayName(sellerInfo, sellerInfo.contents[0]),
                    order_count: seller._count.id,
                    total_revenue: seller._sum.total_amount || 0
                } : null;
            })
        );

        const stats = {
            overview: {
                total_orders: totalOrders,
                today_orders: todayOrders,
                pending_orders: pendingOrders,
                completed_orders: completedOrders,
                total_revenue: totalRevenue._sum.total_amount || 0,
                completion_rate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
            },
            top_sellers: topSellersDetails.filter(Boolean),
            recent_orders: recentOrders.map(order => this.enrichOrderWithContent(order, this.DEFAULT_LANGUAGE)),
            charts: {
                daily_orders: await this.getDailyOrderChart(),
                status_distribution: await this.getStatusDistribution(),
                revenue_trend: await this.getRevenueTrend()
            }
        };

        await this.cacheManager.set(cacheKey, stats, 10 * 60 * 1000); // 10 minutes cache
        return stats;
    }

// ==================== تغییر وضعیت دسته‌جمعی ====================
    async bulkUpdateOrderStatus(orderIds: string[], status: OrderStatus, adminId: string, reason?: string) {
        if (!orderIds || orderIds.length === 0) {
            throw new BadRequestException('لیست سفارشات نمی‌تواند خالی باشد');
        }

        if (orderIds.length > 100) {
            throw new BadRequestException('حداکثر 100 سفارش را می‌توان به صورت همزمان بروزرسانی کرد');
        }

        return await this.prisma.$transaction(async (tx) => {
            const results = {
                successful: [] as string[],
                failed: [] as { orderId: string; reason: string }[]
            };

            for (const orderId of orderIds) {
                try {
                    const order = await tx.order.findUnique({
                        where: { id: orderId }
                    });

                    if (!order) {
                        results.failed.push({
                            orderId,
                            reason: 'سفارش یافت نشد'
                        });
                        continue;
                    }

                    // بروزرسانی وضعیت
                    await tx.order.update({
                        where: { id: orderId },
                        data: {
                            status,
                            metadata: {
                                ...(order.metadata as any),
                                bulk_update: true,
                                status_change_reason: reason,
                                status_changed_by: adminId,
                                status_changed_at: new Date().toISOString()
                            }
                        }
                    });

                    results.successful.push(orderId);

                    // پاکسازی کش
                    await this.clearOrderCaches(order.user_id, order.account_id);

                } catch (error) {
                    results.failed.push({
                        orderId,
                        reason: error.message || 'خطای ناشناخته'
                    });
                }
            }

            return {
                total: orderIds.length,
                successful: results.successful.length,
                failed: results.failed.length,
                details: {
                    successful: results.successful,
                    failed: results.failed
                }
            };
        });
    }

// ==================== آمار روزانه ====================
    async getDailyOrderAnalytics(days: number = 30) {
        const cacheKey = `daily_analytics:${days}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const dailyStats = await this.prisma.order.groupBy({
            by: ['created_at'],
            where: {
                created_at: {
                    gte: startDate
                }
            },
            _count: { id: true },
            _sum: { total_amount: true },
            orderBy: { created_at: 'asc' }
        });

        const analytics = {
            period: {
                start_date: startDate,
                end_date: new Date(),
                days: days
            },
            summary: {
                total_orders: dailyStats.reduce((sum, day) => sum + day._count.id, 0),
                total_revenue: dailyStats.reduce((sum, day) => sum + (day._sum.total_amount || 0), 0),
                average_daily_orders: dailyStats.length > 0 ?
                    dailyStats.reduce((sum, day) => sum + day._count.id, 0) / dailyStats.length : 0
            },
            daily_breakdown: dailyStats.map(day => ({
                date: day.created_at,
                orders: day._count.id,
                revenue: day._sum.total_amount || 0
            })),
            trends: await this.calculateTrends(dailyStats)
        };

        await this.cacheManager.set(cacheKey, analytics, 30 * 60 * 1000); // 30 minutes cache
        return analytics;
    }

// ==================== متدهای کمکی ====================
    private async getLastOrderDate(userId: string): Promise<Date | null> {
        const lastOrder = await this.prisma.order.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            select: { created_at: true }
        });

        return lastOrder?.created_at || null;
    }

    private async calculateAverageOrderValue(userId: string): Promise<number> {
        const result = await this.prisma.order.aggregate({
            where: {
                user_id: userId,
                status: OrderStatus.COMPLETED
            },
            _avg: { total_amount: true }
        });

        return result._avg.total_amount || 0;
    }

    private async getMonthlyStats(userId: string) {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const lastMonth = new Date(currentMonth);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const [currentMonthStats, lastMonthStats] = await Promise.all([
            this.prisma.order.aggregate({
                where: {
                    user_id: userId,
                    created_at: { gte: currentMonth },
                    status: OrderStatus.COMPLETED
                },
                _count: { id: true },
                _sum: { total_amount: true }
            }),
            this.prisma.order.aggregate({
                where: {
                    user_id: userId,
                    created_at: { gte: lastMonth, lt: currentMonth },
                    status: OrderStatus.COMPLETED
                },
                _count: { id: true },
                _sum: { total_amount: true }
            })
        ]);

        return {
            current_month: {
                orders: currentMonthStats._count.id,
                amount: currentMonthStats._sum.total_amount || 0
            },
            last_month: {
                orders: lastMonthStats._count.id,
                amount: lastMonthStats._sum.total_amount || 0
            }
        };
    }

    private async getDailyOrderChart() {
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const dailyOrders = await this.prisma.order.groupBy({
            by: ['created_at'],
            where: {
                created_at: { gte: last7Days }
            },
            _count: { id: true },
            orderBy: { created_at: 'asc' }
        });

        return dailyOrders.map(day => ({
            date: day.created_at.toISOString().split('T')[0],
            orders: day._count.id
        }));
    }

    private async getStatusDistribution() {
        const distribution = await this.prisma.order.groupBy({
            by: ['status'],
            _count: { id: true }
        });

        return distribution.map(item => ({
            status: item.status,
            count: item._count.id
        }));
    }

    private async getRevenueTrend() {
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const revenueByDay = await this.prisma.order.groupBy({
            by: ['created_at'],
            where: {
                created_at: { gte: last30Days },
                status: OrderStatus.COMPLETED
            },
            _sum: { total_amount: true },
            orderBy: { created_at: 'asc' }
        });

        return revenueByDay.map(day => ({
            date: day.created_at.toISOString().split('T')[0],
            revenue: day._sum.total_amount || 0
        }));
    }

    private async calculateTrends(dailyStats: any[]) {
        if (dailyStats.length < 2) {
            return { order_trend: 0, revenue_trend: 0 };
        }

        const recent = dailyStats.slice(-7); // آخرین 7 روز
        const previous = dailyStats.slice(-14, -7); // 7 روز قبل از آن

        const recentOrders = recent.reduce((sum, day) => sum + day._count.id, 0);
        const previousOrders = previous.reduce((sum, day) => sum + day._count.id, 0);

        const recentRevenue = recent.reduce((sum, day) => sum + (day._sum.total_amount || 0), 0);
        const previousRevenue = previous.reduce((sum, day) => sum + (day._sum.total_amount || 0), 0);

        const orderTrend = previousOrders > 0 ?
            ((recentOrders - previousOrders) / previousOrders) * 100 : 0;

        const revenueTrend = previousRevenue > 0 ?
            ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

        return {
            order_trend: Math.round(orderTrend * 100) / 100,
            revenue_trend: Math.round(revenueTrend * 100) / 100
        };
    }
}