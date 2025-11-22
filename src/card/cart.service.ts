import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { OrderStatus, OrderType, Prisma, Language } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CartService {
    private readonly DEFAULT_LANGUAGE = Language.fa;

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    // ==================== دریافت سبد خرید کاربر ====================
    async getCart(userId: string) {
        const cacheKey = `cart:${userId}`;

        // بررسی کش
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        // پیدا کردن سبد خرید
        let cart = await this.prisma.order.findFirst({
            where: {
                user_id: userId,
                status: OrderStatus.PENDING,
                order_type: OrderType.PRODUCT_PURCHASE
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
                                    include: {
                                        contents: {
                                            where: { language: this.DEFAULT_LANGUAGE },
                                            take: 1
                                        },
                                        files: {
                                            where: { file_usage: 'LOGO' },
                                            take: 1
                                        }
                                    }
                                },
                                // شامل کردن اطلاعات قیمت جدید
                                pricing_strategies: {
                                    where: {
                                        is_active: true,
                                        is_primary: true
                                    },
                                    take: 1
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' }
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
        });

        // اگر سبد خرید وجود ندارد، ایجادش کن
        if (!cart) {
            cart = await this.createEmptyCart(userId);
        } else {
            // بررسی اعتبار آیتم‌ها و به‌روزرسانی قیمت‌ها
            cart = await this.validateAndUpdateCartItems(cart);
        }

        // محاسبه مجدد قیمت‌ها
        cart = await this.recalculateCart(cart.id);

        const result = this.formatCartResponse(cart);

        // ذخیره در کش
        await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000); // 5 دقیقه

        return result;
    }

    // ==================== اعتبارسنجی و به‌روزرسانی آیتم‌های سبد خرید ====================
    private async validateAndUpdateCartItems(cart: any) {
        let needsUpdate = false;
        const updatedItems = [];

        for (const item of cart.items) {
            // بررسی وجود محصول
            const product = await this.prisma.product.findUnique({
                where: { id: item.product_id },
                include: {
                    contents: {
                        where: { language: this.DEFAULT_LANGUAGE },
                        take: 1
                    },
                    pricing_strategies: {
                        where: {
                            is_active: true,
                            is_primary: true
                        },
                        take: 1
                    }
                }
            });

            if (!product || product.status !== 'APPROVED' || !product.confirmed) {
                // محصول حذف شده یا غیرفعال شده
                needsUpdate = true;
                continue;
            }

            // بررسی موجودی
            if (product.stock < item.quantity) {
                // تعدیل تعداد به حداکثر موجودی
                const adjustedQuantity = Math.min(item.quantity, product.stock);
                if (adjustedQuantity !== item.quantity) {
                    needsUpdate = true;
                    item.quantity = adjustedQuantity;
                    item.total_price = adjustedQuantity * item.unit_price;
                }
            }

            // بررسی حداقل تعداد خرید
            if (item.quantity < product.min_sale_amount) {
                item.quantity = product.min_sale_amount;
                item.total_price = product.min_sale_amount * item.unit_price;
                needsUpdate = true;
            }

            // بررسی تغییر قیمت
            const currentPrice = this.determineProductPrice(product);
            if (currentPrice !== item.unit_price) {
                needsUpdate = true;
                item.unit_price = currentPrice;
                item.total_price = item.quantity * currentPrice;
            }

            updatedItems.push(item);
        }

        // اگر نیاز به آپدیت بود، سبد رو آپدیت کن
        if (needsUpdate) {
            return await this.prisma.order.update({
                where: { id: cart.id },
                data: {
                    items: {
                        deleteMany: {
                            id: { notIn: updatedItems.map(item => item.id) }
                        },
                        update: updatedItems.map(item => ({
                            where: { id: item.id },
                            data: {
                                quantity: item.quantity,
                                unit_price: item.unit_price,
                                total_price: item.total_price
                            }
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
                                        include: {
                                            contents: {
                                                where: { language: this.DEFAULT_LANGUAGE },
                                                take: 1
                                            },
                                            files: {
                                                where: { file_usage: 'LOGO' },
                                                take: 1
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: { created_at: 'desc' }
                    }
                }
            });
        }

        return cart;
    }

    // ==================== افزودن به سبد خرید ====================
    async addToCart(addToCartDto: AddToCartDto, userId: string) {
        const { product_id, quantity, account_id } = addToCartDto;

        // بررسی محصول با سیستم قیمت‌گذاری جدید
        const product = await this.prisma.product.findUnique({
            where: {
                id: product_id,
                status: 'APPROVED',
                confirmed: true
            },
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
                },
                // گرفتن قیمت از استراتژی‌های فعال
                pricing_strategies: {
                    where: {
                        is_active: true,
                        OR: [
                            { is_primary: true },
                            { condition_category: 'PAYMENT_SETTLEMENT', condition_type: 'CASH_PAYMENT' }
                        ]
                    },
                    orderBy: { is_primary: 'desc' },
                    take: 1
                }
            }
        });

        if (!product) {
            throw new NotFoundException('محصول یافت نشد یا غیرفعال است');
        }

        if (!product.account.is_active) {
            throw new BadRequestException('اکانت فروشنده غیرفعال است');
        }

        if (product.stock < quantity) {
            throw new BadRequestException(
                `موجودی محصول کافی نیست. موجودی: ${product.stock}، درخواستی: ${quantity}`
            );
        }

        if (quantity < product.min_sale_amount) {
            throw new BadRequestException(
                `حداقل مقدار خرید: ${product.min_sale_amount}`
            );
        }

        // تعیین قیمت واحد
        const unitPrice = this.determineProductPrice(product);
        const productName = product.contents[0]?.name || 'محصول';

        // پیدا کردن یا ایجاد سبد خرید
        let cart = await this.prisma.order.findFirst({
            where: {
                user_id: userId,
                status: OrderStatus.PENDING,
                order_type: OrderType.PRODUCT_PURCHASE
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true }
                        }
                    }
                }
            }
        });

        if (!cart) {
            cart = await this.createEmptyCart(userId, account_id);
        }

        // بررسی آیا محصول از قبل در سبد هست
        const existingItem = cart.items.find(item => item.product_id === product_id);

        return await this.prisma.$transaction(async (tx) => {
            if (existingItem) {
                // بروزرسانی تعداد
                const newQuantity = existingItem.quantity + quantity;
                await tx.orderItem.update({
                    where: { id: existingItem.id },
                    data: {
                        quantity: newQuantity,
                        total_price: newQuantity * existingItem.unit_price
                    }
                });
            } else {
                // افزودن آیتم جدید
                await tx.orderItem.create({
                    data: {
                        order_id: cart.id,
                        product_id: product_id,
                        item_type: 'PRODUCT',
                        item_title: productName,
                        quantity: quantity,
                        unit_price: unitPrice,
                        total_price: quantity * unitPrice,
                        description: `واحد: ${product.unit}`
                    }
                });
            }

            // محاسبه مجدد سبد خرید
            const updatedCart = await this.recalculateCart(cart.id, tx);
            await this.clearCartCache(userId);

            return this.formatCartResponse(updatedCart);
        });
    }

    // ==================== تعیین قیمت محصول ====================
    private determineProductPrice(product: any): number {
        // اولویت ۱: قیمت از استراتژی‌های قیمت‌گذاری
        if (product.pricing_strategies && product.pricing_strategies.length > 0) {
            const strategy = product.pricing_strategies[0];
            if (strategy.final_price_amount) {
                return strategy.final_price_amount;
            }
            if (strategy.base_price_amount) {
                return strategy.base_price_amount;
            }
        }

        // اولویت ۲: استفاده از base_min_price و base_max_price
        if (product.base_min_price) {
            return product.base_min_price;
        }

        throw new BadRequestException('قیمت محصول تعریف نشده است');
    }

    // ==================== بروزرسانی آیتم سبد خرید ====================
    async updateCartItem(itemId: string, updateDto: UpdateCartItemDto, userId: string) {
        const { quantity } = updateDto;

        const item = await this.prisma.orderItem.findUnique({
            where: { id: itemId },
            include: {
                order: true,
                product: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!item) {
            throw new NotFoundException('آیتم یافت نشد');
        }

        // بررسی مالکیت
        if (item.order.user_id !== userId) {
            throw new BadRequestException('دسترسی به این سبد خرید ندارید');
        }

        if (quantity === 0) {
            // حذف آیتم
            return await this.removeFromCart(itemId, userId);
        }

        // بررسی موجودی
        if (item.product.stock < quantity) {
            throw new BadRequestException(
                `موجودی محصول کافی نیست. موجودی: ${item.product.stock}، درخواستی: ${quantity}`
            );
        }

        return await this.prisma.$transaction(async (tx) => {
            // بروزرسانی آیتم
            await tx.orderItem.update({
                where: { id: itemId },
                data: {
                    quantity: quantity,
                    total_price: quantity * item.unit_price
                }
            });

            // محاسبه مجدد سبد خرید
            const updatedCart = await this.recalculateCart(item.order_id, tx);

            await this.clearCartCache(userId);

            return this.formatCartResponse(updatedCart);
        });
    }

    // ==================== حذف از سبد خرید ====================
    async removeFromCart(itemId: string, userId: string) {
        const item = await this.prisma.orderItem.findUnique({
            where: { id: itemId },
            include: { order: true }
        });

        if (!item) {
            throw new NotFoundException('آیتم یافت نشد');
        }

        if (item.order.user_id !== userId) {
            throw new BadRequestException('دسترسی به این سبد خرید ندارید');
        }

        return await this.prisma.$transaction(async (tx) => {
            await tx.orderItem.delete({
                where: { id: itemId }
            });

            const updatedCart = await this.recalculateCart(item.order_id, tx);
            await this.clearCartCache(userId);

            return this.formatCartResponse(updatedCart);
        });
    }

    // ==================== خالی کردن سبد خرید ====================
    async clearCart(userId: string) {
        const cart = await this.prisma.order.findFirst({
            where: {
                user_id: userId,
                status: OrderStatus.PENDING,
                order_type: OrderType.PRODUCT_PURCHASE
            }
        });

        if (!cart) {
            return { message: 'سبد خرید از قبل خالی است' };
        }

        await this.prisma.orderItem.deleteMany({
            where: { order_id: cart.id }
        });

        await this.recalculateCart(cart.id);
        await this.clearCartCache(userId);

        return { message: 'سبد خرید خالی شد' };
    }

    // ==================== متدهای کمکی ====================

    // ==================== ایجاد سبد خرید خالی ====================
    private async createEmptyCart(userId: string, accountId?: string) {
        const orderNumber = await this.generateOrderNumber();

        return await this.prisma.order.create({
            data: {
                order_number: orderNumber,
                order_type: OrderType.PRODUCT_PURCHASE,
                status: OrderStatus.PENDING,
                user_id: userId,
                account_id: accountId,
                total_amount: 0,
                tax_amount: 0,
                discount_amount: 0,
                net_amount: 0,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 روز
                metadata: {
                    is_cart: true,
                    created_via: 'CART_SERVICE'
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
                                    include: {
                                        contents: {
                                            where: { language: this.DEFAULT_LANGUAGE },
                                            take: 1
                                        },
                                        files: {
                                            where: { file_usage: 'LOGO' },
                                            take: 1
                                        }
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' }
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
        });
    }

    private async recalculateCart(cartId: string, tx?: Prisma.TransactionClient) {
        const prisma = tx || this.prisma;

        const items = await prisma.orderItem.findMany({
            where: { order_id: cartId },
            select: {
                quantity: true,
                unit_price: true,
                total_price: true
            }
        });

        const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
        const taxAmount = Math.round(totalAmount * 0.09); // 9% مالیات
        const netAmount = totalAmount + taxAmount;

        return await prisma.order.update({
            where: { id: cartId },
            data: {
                total_amount: totalAmount,
                tax_amount: taxAmount,
                net_amount: netAmount
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
                                    include: {
                                        contents: {
                                            where: { language: this.DEFAULT_LANGUAGE },
                                            take: 1
                                        },
                                        files: {
                                            where: { file_usage: 'LOGO' },
                                            take: 1
                                        }
                                    }
                                }
                            }
                        }
                    },
                    orderBy: { created_at: 'desc' }
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
        });
    }

    // ==================== فرمت‌دهی پاسخ سبد خرید ====================
    private formatCartResponse(cart: any) {
        const items = cart.items || [];

        return {
            id: cart.id,
            order_number: cart.order_number,
            status: cart.status,
            total_amount: cart.total_amount || 0,
            tax_amount: cart.tax_amount || 0,
            discount_amount: cart.discount_amount || 0,
            net_amount: cart.net_amount || 0,
            total_items: items.length,
            total_quantity: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
            expires_at: cart.expires_at,
            created_at: cart.created_at,

            items: items.map(item => ({
                id: item.id,
                product: {
                    id: item.product?.id,
                    name: item.product?.contents[0]?.name || 'محصول حذف شده',
                    unit: item.product?.unit,
                    stock: item.product?.stock || 0,
                    min_sale_amount: item.product?.min_sale_amount || 1,
                    display_price: item.unit_price,
                    account: {
                        id: item.product?.account?.id,
                        name: item.product?.account?.contents[0]?.name || 'نامشخص',
                        activity_type: item.product?.account?.activity_type,
                        profile_photo: item.product?.account?.files[0]?.file_path
                    }
                },
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                item_type: item.item_type,
                description: item.description
            })),

            // گروه‌بندی بر اساس فروشنده
            sellers: this.groupItemsBySeller(items),

            // اطلاعات خلاصه
            summary: {
                total_unique_products: new Set(items.map((item: any) => item.product_id)).size,
                total_unique_sellers: new Set(items.map((item: any) => item.product?.account?.id).filter(Boolean)).size,
                can_checkout: items.length > 0,
                has_out_of_stock: items.some((item: any) => (item.product?.stock || 0) < item.quantity),
                price_summary: {
                    subtotal: cart.total_amount || 0,
                    tax: cart.tax_amount || 0,
                    discount: cart.discount_amount || 0,
                    total: cart.net_amount || 0,
                    currency: 'ریال'
                }
            }
        };
    }

    // ==================== گروه‌بندی آیتم‌ها بر اساس فروشنده ====================
    private groupItemsBySeller(items: any[]) {
        const sellerMap = new Map();

        items.forEach(item => {
            if (!item.product?.account) return;

            const sellerAccount = item.product.account;
            const sellerId = sellerAccount.id;

            if (!sellerMap.has(sellerId)) {
                sellerMap.set(sellerId, {
                    seller: {
                        id: sellerAccount.id,
                        name: sellerAccount.contents[0]?.name || 'نامشخص',
                        activity_type: sellerAccount.activity_type,
                        profile_photo: sellerAccount.files[0]?.file_path
                    },
                    items: [],
                    total_amount: 0,
                    total_quantity: 0,
                    items_count: 0
                });
            }

            const sellerData = sellerMap.get(sellerId);
            sellerData.items.push({
                id: item.id,
                product: {
                    id: item.product.id,
                    name: item.product.contents[0]?.name || 'محصول',
                    unit: item.product.unit
                },
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
            });

            sellerData.total_amount += item.total_price;
            sellerData.total_quantity += item.quantity;
            sellerData.items_count += 1;
        });

        return Array.from(sellerMap.values());
    }

    private async generateOrderNumber(): Promise<string> {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CART-${timestamp}-${random}`;
    }

    private async clearCartCache(userId: string): Promise<void> {
        await this.cacheManager.del(`cart:${userId}`);
    }
}