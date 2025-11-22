// src/product-price/dto/product-price-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { PricingConditionCategory, PricingConditionType, SellUnit } from '@prisma/client';

export class ProductPriceQueryDto {
    @ApiPropertyOptional({ description: 'آیدی محصول' })
    @IsOptional()
    @IsString()
    product_id?: string;

    @ApiPropertyOptional({ enum: SellUnit, description: 'واحد قیمت' })
    @IsOptional()
    @IsEnum(SellUnit)
    price_unit?: SellUnit;

    @ApiPropertyOptional({ enum: PricingConditionCategory, description: 'دسته شرط' })
    @IsOptional()
    @IsEnum(PricingConditionCategory)
    condition_category?: PricingConditionCategory;

    @ApiPropertyOptional({ enum: PricingConditionType, description: 'نوع شرط' })
    @IsOptional()
    @IsEnum(PricingConditionType)
    condition_type?: PricingConditionType;

    @ApiPropertyOptional({ description: 'حداقل قیمت' })
    @IsOptional()
    @IsNumber()
    min_price?: number;

    @ApiPropertyOptional({ description: 'حداکثر قیمت' })
    @IsOptional()
    @IsNumber()
    max_price?: number;

    @ApiPropertyOptional({ description: 'دارای تخفیف' })
    @IsOptional()
    @IsBoolean()
    has_discount?: boolean;

    @ApiPropertyOptional({ description: 'فقط قیمت‌های فعال', default: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiPropertyOptional({ description: 'شماره صفحه', default: 1 })
    @IsOptional()
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({ description: 'تعداد در هر صفحه', default: 20 })
    @IsOptional()
    @IsNumber()
    limit?: number;
}