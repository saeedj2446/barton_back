// src/products/dto/calculate-price.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentMethodType } from '@prisma/client';

export class CalculatePriceDto {
    @ApiProperty({
        description: 'روش پرداخت',
        enum: PaymentMethodType
    })
    @IsEnum(PaymentMethodType)
    paymentMethod: PaymentMethodType;

    @ApiProperty({
        description: 'قیمت پایه (اختیاری - اگر ارسال نشود از قیمت محصول استفاده می‌شود)',
        required: false
    })
    @IsNumber()
    @Min(0)
    @IsOptional()
    basePrice?: number;

    @ApiProperty({
        description: 'تعداد (اختیاری - برای محاسبه قیمت کل)',
        required: false,
        default: 1
    })
    @IsNumber()
    @Min(1)
    @IsOptional()
    quantity?: number;
}