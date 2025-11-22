import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AbstractPaymentGateway, PaymentInitiateParams, PaymentVerifyParams } from './gateways/abstract-payment.gateway';
import { PrismaService } from '../prisma/prisma.service';
import {RayanPayGateway} from "./gateways/rayanpay.gateway";
import {PaymentConfig} from "./payment.config";
import {PecGateway} from "./gateways/parsian.gateway";
import {ZarinpalGateway} from "./gateways/zarinpal.gateway";

@Injectable()
export class PaymentService {
    private gateway: AbstractPaymentGateway;

    constructor(
        private prisma: PrismaService,
        private httpService: HttpService,
        @Inject('PAYMENT_CONFIG') private config: PaymentConfig,

    ) {
        this.initializeGateway();
    }

    // payment.service.ts - آپدیت متد initializeGateway
    // src/payment/payment.service.ts - آپدیت متد initializeGateway
    private initializeGateway() {
        switch (this.config.defaultGateway) {
            case 'zarinpal':
                this.gateway = new ZarinpalGateway(
                    this.config.gateways.zarinpal,
                    this.httpService
                );
                break;
            case 'rayanpay':
                this.gateway = new RayanPayGateway(
                    this.config.gateways.rayanpay,
                    this.httpService
                );
                break;
            case 'pec': // اضافه کردن درگاه پارسیان
                this.gateway = new PecGateway(
                    this.config.gateways.pec,
                    this.httpService
                );
                break;
            default:
                throw new Error('Payment gateway not configured');
        }
    }

    async initiateOrderPayment(orderId: string, userId: string, callbackUrl: string) {
        // اعتبارسنجی سفارش
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true }
        });

        if (!order) {
            throw new BadRequestException('سفارش یافت نشد');
        }

        if (order.user_id !== userId) {
            throw new BadRequestException('دسترسی به این سفارش ندارید');
        }

        if (order.status !== 'PENDING') {
            throw new BadRequestException('سفارش قابل پرداخت نیست');
        }

        // ایجاد تراکنش در دیتابیس
        const transaction = await this.prisma.transaction.create({
            data: {
                transaction_number: this.gateway.generateTransactionId(),
                order_id: orderId,
                user_id: userId,
                amount: order.net_amount,
                net_amount: order.net_amount,
                currency: 'IRR',
                transaction_type: 'DEBIT',
                payment_method: 'ONLINE_GATEWAY',
                status: 'PENDING'
            }
        });

        // شروع پرداخت با درگاه
        const paymentParams: PaymentInitiateParams = {
            amount: order.net_amount,
            order_id: orderId,
            user_id: userId,
            callback_url: callbackUrl,
            description: `پرداخت سفارش ${order.order_number}`,
            metadata: {
                order_number: order.order_number,
                transaction_id: transaction.id
            }
        };

        const paymentResult = await this.gateway.initiatePayment(paymentParams);

        // ذخیره اطلاعات درگاه
        const gatewayResponse = {
            gateway: this.gateway.getName(),
            order_number: order.order_number,
            initiated_at: new Date().toISOString(),
            success: paymentResult.success,
            payment_url: paymentResult.payment_url,
            transaction_id: paymentResult.transaction_id,
            gateway_reference: paymentResult.gateway_reference,
            amount: paymentResult.amount,
            error_code: paymentResult.error_code || null,
            error_message: paymentResult.error_message || null
        };

        await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: {
                gateway_reference: paymentResult.gateway_reference,
                gateway_response: gatewayResponse
            }
        });

        if (!paymentResult.success) {
            throw new BadRequestException(
                paymentResult.error_message || 'خطا در اتصال به درگاه پرداخت'
            );
        }

        return {
            transaction_id: transaction.id,
            payment_url: paymentResult.payment_url,
            gateway_reference: paymentResult.gateway_reference,
            amount: order.net_amount,
            order_number: order.order_number
        };
    }

    async verifyPayment(authority: string, status: string) {
        const transaction = await this.prisma.transaction.findFirst({
            where: {
                gateway_reference: authority,
                status: 'PENDING'
            },
            include: {
                order: true
            }
        });

        if (!transaction) {
            return {
                success: false,
                message: 'تراکنش یافت نشد',
                transaction_id: 'unknown'
            };
        }

        if (status !== 'OK') {
            await this.handleFailedPayment(transaction.id);
            return {
                success: false,
                message: 'پرداخت توسط کاربر لغو شد',
                transaction_id: transaction.id
            };
        }

        const verifyParams: PaymentVerifyParams = {
            transaction_id: transaction.id,
            gateway_reference: authority,
            amount: transaction.amount
        };

        const verifyResult = await this.gateway.verifyPayment(verifyParams);

        if (verifyResult.success) {
            return await this.handleSuccessfulPayment(transaction.id, verifyResult);
        } else {
            return await this.handleFailedPayment(transaction.id, verifyResult.error_message);
        }
    }

    private async handleSuccessfulPayment(transactionId: string, verifyResult: any) {
        return await this.prisma.$transaction(async (tx) => {
            const updatedTransaction = await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    status: 'SUCCESS',
                    completed_at: new Date(),
                    gateway_response: {
                        ...verifyResult,
                        verified_at: new Date().toISOString()
                    } as any
                },
                include: {
                    order: true
                }
            });

            await tx.order.update({
                where: { id: updatedTransaction.order_id },
                data: {
                    status: 'PAID',
                    paid_at: new Date(),
                    payment_method: 'ONLINE_GATEWAY'
                }
            });

            return {
                success: true,
                message: 'پرداخت با موفقیت انجام شد',
                transaction_id: transactionId,
                order_id: updatedTransaction.order_id,
                tracking_code: verifyResult.tracking_code,
                amount: verifyResult.amount
            };
        });
    }

    private async handleFailedPayment(transactionId: string, errorMessage?: string) {
        await this.prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: 'FAILED',
                error_message: errorMessage || 'پرداخت ناموفق',
                gateway_response: {
                    error: errorMessage || 'پرداخت ناموفق',
                    failed_at: new Date().toISOString()
                } as any
            }
        });

        return {
            success: false,
            message: errorMessage || 'پرداخت ناموفق بود',
            transaction_id: transactionId
        };
    }

    // متدهای کمکی برای سرویس تراکنش
    async initiateGatewayPayment(params: {
        amount: number;
        order_id: string;
        user_id: string;
        callback_url: string;
        description: string;
    }) {
        const paymentParams: PaymentInitiateParams = {
            amount: params.amount,
            order_id: params.order_id,
            user_id: params.user_id,
            callback_url: params.callback_url,
            description: params.description,
            metadata: {
                order_id: params.order_id,
                user_id: params.user_id
            }
        };

        return this.gateway.initiatePayment(paymentParams);
    }

    async verifyGatewayPayment(params: {
        gateway_reference: string;
        amount: number;
    }) {
        const verifyParams: PaymentVerifyParams = {
            transaction_id: params.gateway_reference,
            gateway_reference: params.gateway_reference,
            amount: params.amount
        };

        return this.gateway.verifyPayment(verifyParams);
    }

    getGatewayName(): string {
        return this.gateway.getName();
    }

    generateTransactionId(): string {
        return this.gateway.generateTransactionId();
    }
}

export interface PaymentSuccessResult {
    success: true;
    message: string;
    transaction_id: string;
    order_id: string;
    tracking_code?: string;
    amount: number;
}

export interface PaymentFailedResult {
    success: false;
    message: string;
    transaction_id: string;
}

export type PaymentVerifyResult = PaymentSuccessResult | PaymentFailedResult;