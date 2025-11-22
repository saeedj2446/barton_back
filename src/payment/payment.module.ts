// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    imports: [HttpModule],
    controllers: [PaymentController],
    providers: [
        PaymentService,
        PrismaService,
        {
            provide: 'PAYMENT_CONFIG',
            useValue: {
                defaultGateway: process.env.DEFAULT_PAYMENT_GATEWAY || 'rayanpay',
                gateways: {
                    zarinpal: {
                        merchantId: process.env.ZARINPAL_MERCHANT_ID,
                        sandbox: process.env.ZARINPAL_SANDBOX === 'true',
                        callbackUrl: process.env.PAYMENT_CALLBACK_URL,
                    },
                    rayanpay: {
                        pin: process.env.RAYANPAY_PIN,
                        sandbox: process.env.RAYANPAY_SANDBOX === 'true',
                        callbackUrl: process.env.PAYMENT_CALLBACK_URL,
                    },
                    pec: {
                        pin: process.env.PEC_PIN,
                        terminal: process.env.PEC_TERMINAL,
                        sandbox: process.env.PEC_SANDBOX === 'false', // چون پارسیان اطلاعات واقعی دارید
                        callbackUrl: process.env.PAYMENT_CALLBACK_URL,
                    },
                },
            },
        },
    ],
    exports: [PaymentService],
})
export class PaymentModule {}