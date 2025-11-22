import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
    AbstractPaymentGateway,
    PaymentInitiateParams,
    PaymentInitiateResult,
    PaymentVerifyParams,
    PaymentVerifyResult,
    PaymentRefundParams,
    PaymentRefundResult,
    PaymentStatusResult,
} from './abstract-payment.gateway';

export interface RayanPayConfig {
    pin: string; // PIN درگاه - برای تست از "sandbox" استفاده کنید
    callbackUrl: string;
    sandbox?: boolean;
}

interface RayanPayRequestResponse {
    code: number;
    message: string;
    authority: string;
    fee_type: string;
    fee: number;
}

interface RayanPayVerifyResponse {
    code: number;
    message: string;
    card_hash: string;
    card_pan: string;
    ref_id: number;
    fee_type: string;
    fee: number;
}

@Injectable()
export class RayanPayGateway extends AbstractPaymentGateway {
    private readonly baseUrl: string;

    constructor(
        private readonly config: RayanPayConfig,
        private readonly httpService: HttpService,
    ) {
        super();
        this.baseUrl = config.sandbox
            ? 'https://panel.aqayepardakht.ir/api/'
            : 'https://panel.aqayepardakht.ir/api/';
    }

    getName(): string {
        return 'RayanPay';
    }

    async initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
        try {
            this.validateAmount(params.amount);

            const requestData = {
                pin: this.config.pin,
                amount: params.amount,
                callback: params.callback_url || this.config.callbackUrl,
                invoice_id: params.order_id,
                mobile: params.metadata?.mobile, // در صورت نیاز برای ارسال پیامک
            };

            const response = await firstValueFrom(
                this.httpService.post<RayanPayRequestResponse>(
                    `${this.baseUrl}create`,
                    requestData,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    },
                ),
            );

            if (response.data.code === 200) {
                const paymentUrl = `${this.baseUrl}pay/${response.data.authority}`;

                return {
                    success: true,
                    payment_url: paymentUrl,
                    transaction_id: params.order_id,
                    gateway_reference: response.data.authority,
                    amount: params.amount,
                };
            } else {
                return {
                    success: false,
                    payment_url: '',
                    transaction_id: params.order_id,
                    gateway_reference: '',
                    amount: params.amount,
                    error_code: response.data.code.toString(),
                    error_message: this.getErrorMessage(response.data.code),
                };
            }
        } catch (error) {
            return {
                success: false,
                payment_url: '',
                transaction_id: params.order_id,
                gateway_reference: '',
                amount: params.amount,
                error_code: '500',
                error_message: error.message,
            };
        }
    }

    async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
        try {
            const verifyData = {
                pin: this.config.pin,
                authority: params.gateway_reference,
                amount: params.amount,
            };

            const response = await firstValueFrom(
                this.httpService.post<RayanPayVerifyResponse>(
                    `${this.baseUrl}verify`,
                    verifyData,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    },
                ),
            );

            if (response.data.code === 200) {
                return {
                    success: true,
                    transaction_id: params.transaction_id,
                    amount: params.amount,
                    gateway_reference: params.gateway_reference,
                    card_hash: response.data.card_hash,
                    card_number: response.data.card_pan,
                    tracking_code: response.data.ref_id.toString(),
                };
            } else {
                return {
                    success: false,
                    transaction_id: params.transaction_id,
                    amount: params.amount,
                    gateway_reference: params.gateway_reference,
                    error_code: response.data.code.toString(),
                    error_message: this.getErrorMessage(response.data.code),
                };
            }
        } catch (error) {
            return {
                success: false,
                transaction_id: params.transaction_id,
                amount: params.amount,
                gateway_reference: params.gateway_reference,
                error_code: '500',
                error_message: error.message,
            };
        }
    }

    async refundPayment(params: PaymentRefundParams): Promise<PaymentRefundResult> {
        try {
            const refundData = {
                pin: this.config.pin,
                authority: params.transaction_id, // یا gateway_reference بسته به مستندات
                amount: params.amount,
            };

            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}refund`, refundData, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }),
            );

            if (response.data.code === 200) {
                return {
                    success: true,
                    refund_id: response.data.refund_id,
                    gateway_reference: params.transaction_id,
                };
            } else {
                return {
                    success: false,
                    gateway_reference: params.transaction_id,
                    error_code: response.data.code.toString(),
                    error_message: this.getErrorMessage(response.data.code),
                };
            }
        } catch (error) {
            return {
                success: false,
                gateway_reference: params.transaction_id,
                error_code: '500',
                error_message: error.message,
            };
        }
    }

    async getPaymentStatus(transactionId: string): Promise<PaymentStatusResult> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}inquiry`,
                    {
                        pin: this.config.pin,
                        authority: transactionId,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    },
                ),
            );

            return {
                status: this.mapStatus(response.data.status),
                amount: response.data.amount,
                gateway_reference: transactionId,
                transaction_date: new Date(response.data.date),
            };
        } catch (error) {
            return {
                status: 'PENDING',
                amount: 0,
                gateway_reference: transactionId,
            };
        }
    }

    private getErrorMessage(code: number): string {
        const errors = {
            200: 'تراکنش با موفقیت انجام شد',
            400: 'پارامترهای ارسالی صحیح نیست',
            401: 'پین درگاه صحیح نیست',
            402: 'حساب شما غیرفعال است',
            403: 'آی پی شما در سیستم ثبت نشده است',
            404: 'درخواست شما یافت نشد',
            405: 'مبلغ تراکنش کمتر از حد مجاز است',
            406: 'مبلغ تراکنش بیشتر از حد مجاز است',
            407: 'درگاه پرداختی برای پذیرنده وجود ندارد',
            408: 'توکن منقضی شده است',
            409: 'اطلاعات درخواستی صحیح نیست',
            410: 'تراکنش قبلا برگشت خورده است',
            411: 'سیستم موقتا قطع شده است',
            412: 'ثبت تراکنش ناموفق بود',
            413: 'آدرس بازگشت مشخص نشده است',
            414: 'فرمت درخواستی صحیح نیست',
            415: 'پذیرنده فعال نیست',
            416: 'درخواست از سمت آی پی نا معتبر ارسال شده است',
        };

        return errors[code] || `خطای ناشناخته: ${code}`;
    }

    private mapStatus(status: string): 'PENDING' | 'SUCCESS' | 'FAILED' | 'VERIFIED' | 'REFUNDED' {
        const statusMap = {
            pending: 'PENDING',
            success: 'SUCCESS',
            failed: 'FAILED',
            verified: 'VERIFIED',
            refunded: 'REFUNDED',
        };
        return statusMap[status] || 'PENDING';
    }
}