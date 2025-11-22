import { Controller, Post, Body, Get, Query, UseGuards, Request, Res, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PaymentService, PaymentSuccessResult, PaymentFailedResult } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {}


    @Post('initiate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'شروع پرداخت سفارش' })
    @ApiResponse({ status: 200, description: 'پرداخت با موفقیت شروع شد' })
    @ApiResponse({ status: 400, description: 'خطا در شروع پرداخت' })
    @ApiResponse({ status: 404, description: 'سفارش یافت نشد' })
    async initiatePayment(
        @Request() req,
        @Body('order_id') orderId: string,
        @Body('callback_url') callbackUrl: string,
    ) {
        if (!orderId) {
            throw new HttpException('شناسه سفارش الزامی است', 400);
        }
        if (!callbackUrl) {
            throw new HttpException('آدرس بازگشت الزامی است', 400);
        }

        return this.paymentService.initiateOrderPayment(orderId, req.user.id, callbackUrl);
    }


    @Get('verify')
    @ApiOperation({ summary: 'تایید پرداخت (callback از درگاه)' })
    @ApiResponse({ status: 302, description: 'ریدایرکت به صفحه نتیجه پرداخت' })
    async verifyPayment(
        @Query('Authority') authority: string,
        @Query('Status') status: string,
        @Query('au') au: string, // اضافه کردن پشتیبانی از پارامترهای آقای پرداخت
        @Query('transid') transid: string,
        @Res() res: Response,
    ) {
        // پشتیبانی از هر دو درگاه
        const gatewayReference = authority || au || transid;

        if (!gatewayReference) {
            return res.redirect('/payment/failed?message=کد ارجاع درگاه یافت نشد');
        }

        // پشتیبانی از status های مختلف
        const paymentStatus = status || 'OK'; // آقای پرداخت ممکن است status نداشته باشد

        try {
            const result = await this.paymentService.verifyPayment(gatewayReference, paymentStatus);

            // بقیه کد بدون تغییر...
            if (result.success) {
                const successResult = result as PaymentSuccessResult;
                return res.redirect(
                    `/payment/success?transaction_id=${successResult.transaction_id}` +
                    (successResult.tracking_code ? `&tracking_code=${successResult.tracking_code}` : '')
                );
            } else {
                const failedResult = result as PaymentFailedResult;
                return res.redirect(
                    `/payment/failed?transaction_id=${failedResult.transaction_id}` +
                    `&message=${encodeURIComponent(failedResult.message)}`
                );
            }
        } catch (error) {
            return res.redirect(`/payment/failed?message=${encodeURIComponent('خطا در تایید پرداخت')}`);
        }
    }

    @Get('success')
    @ApiOperation({ summary: 'صفحه موفقیت پرداخت' })
    @ApiResponse({ status: 200, description: 'صفحه موفقیت پرداخت نمایش داده شد' })
    async paymentSuccess(
        @Query('transaction_id') transactionId: string,
        @Query('tracking_code') trackingCode: string,
        @Res() res: Response,
    ) {
        if (!transactionId) {
            return res.redirect('/payment/failed?message=شناسه تراکنش یافت نشد');
        }

        const html = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پرداخت موفق - بازار یابی</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        .success-icon {
            font-size: 80px;
            color: #10b981;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #059669;
            margin-bottom: 20px;
            font-size: 28px;
        }
        
        .info-card {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            text-align: right;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .info-label {
            color: #64748b;
            font-weight: 500;
        }
        
        .info-value {
            color: #1e293b;
            font-weight: 600;
            font-family: 'Courier New', monospace;
        }
        
        .btn {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            margin: 8px;
        }
        
        .btn:hover {
            background: #2563eb;
            transform: translateY(-2px);
        }
        
        .btn-outline {
            background: transparent;
            color: #3b82f6;
            border: 2px solid #3b82f6;
        }
        
        .btn-outline:hover {
            background: #3b82f6;
            color: white;
        }
        
        .message {
            color: #64748b;
            margin: 20px 0;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>پرداخت با موفقیت انجام شد</h1>
        
        <div class="info-card">
            <div class="info-row">
                <span class="info-label">شناسه تراکنش:</span>
                <span class="info-value">${transactionId}</span>
            </div>
            ${trackingCode ? `
            <div class="info-row">
                <span class="info-label">کد رهگیری:</span>
                <span class="info-value">${trackingCode}</span>
            </div>
            ` : ''}
        </div>
        
        <p class="message">
            سفارش شما با موفقیت ثبت و پرداخت شد. می‌توانید از طریق پنل کاربری وضعیت سفارش خود را پیگیری کنید.
        </p>
        
        <div>
            <a href="/orders" class="btn">مشاهده سفارش‌ها</a>
            <a href="/" class="btn btn-outline">بازگشت به خانه</a>
        </div>
    </div>
</body>
</html>
        `;

        return res.send(html);
    }

    @Get('failed')
    @ApiOperation({ summary: 'صفحه خطای پرداخت' })
    @ApiResponse({ status: 200, description: 'صفحه خطای پرداخت نمایش داده شد' })
    async paymentFailed(
        @Query('transaction_id') transactionId: string,
        @Query('message') message: string,
        @Res() res: Response,
    ) {
        const errorMessage = message || 'خطای ناشناخته در پرداخت';

        const html = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>خطا در پرداخت - بازار یابی</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        .error-icon {
            font-size: 80px;
            color: #ef4444;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #dc2626;
            margin-bottom: 20px;
            font-size: 28px;
        }
        
        .error-card {
            background: #fef2f2;
            border: 2px solid #fecaca;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            text-align: right;
        }
        
        .error-message {
            color: #dc2626;
            font-weight: 500;
            margin-bottom: 16px;
            line-height: 1.6;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #fecaca;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .info-label {
            color: #78716c;
            font-weight: 500;
        }
        
        .info-value {
            color: #1e293b;
            font-weight: 600;
            font-family: 'Courier New', monospace;
        }
        
        .btn {
            display: inline-block;
            background: #ef4444;
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            margin: 8px;
        }
        
        .btn:hover {
            background: #dc2626;
            transform: translateY(-2px);
        }
        
        .btn-outline {
            background: transparent;
            color: #ef4444;
            border: 2px solid #ef4444;
        }
        
        .btn-outline:hover {
            background: #ef4444;
            color: white;
        }
        
        .note {
            color: #78716c;
            margin: 20px 0;
            line-height: 1.6;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>خطا در پرداخت</h1>
        
        <div class="error-card">
            <div class="error-message">${errorMessage}</div>
            ${transactionId ? `
            <div class="info-row">
                <span class="info-label">شناسه تراکنش:</span>
                <span class="info-value">${transactionId}</span>
            </div>
            ` : ''}
        </div>
        
        <p class="note">
            در صورت کسر مبلغ از حساب شما، وجه پرداختی طی ۷۲ ساعت کاری به حساب شما بازگردانده خواهد شد.
        </p>
        
        <div>
            <a href="/cart" class="btn">بازگشت به سبد خرید</a>
            <a href="/" class="btn btn-outline">بازگشت به خانه</a>
        </div>
    </div>
</body>
</html>
        `;

        return res.send(html);
    }
}