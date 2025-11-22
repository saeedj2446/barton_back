// src/product-price/dto/create-product-price.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsObject } from 'class-validator';
import { PricingConditionCategory, PricingConditionType, SellUnit } from '@prisma/client';

export class CreateProductPriceDto {
    @ApiProperty({ description: 'آیدی محصول' })
    @IsString()
    product_id: string;

    @ApiProperty({ enum: SellUnit, description: 'واحد قیمت' })
    @IsEnum(SellUnit)
    price_unit: SellUnit; // 🔥 اینجا درست شده

    @ApiProperty({ description: 'قیمت پایه' })
    @IsNumber()
    base_price_amount: number;

    @ApiPropertyOptional({ description: 'ضریب تبدیل به واحد اصلی', default: 1.0 })
    @IsOptional()
    @IsNumber()
    conversion_rate?: number;

    @ApiPropertyOptional({ enum: PricingConditionCategory, description: 'دسته شرط' })
    @IsOptional()
    @IsEnum(PricingConditionCategory)
    condition_category?: PricingConditionCategory;

    @ApiPropertyOptional({ enum: PricingConditionType, description: 'نوع شرط' })
    @IsOptional()
    @IsEnum(PricingConditionType)
    condition_type?: PricingConditionType;

    @ApiPropertyOptional({ description: 'درصد تغییر قیمت (مثبت برای افزایش، منفی برای کاهش)' })
    @IsOptional()
    @IsNumber()
    custom_adjustment_percent?: number;

    @ApiPropertyOptional({ description: 'تنظیمات اختصاصی شرط' })
    @IsOptional()
    @IsObject()
    condition_config?: any;
}