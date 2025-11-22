// src/product-price/dto/update-product-price.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateProductPriceDto } from './create-product-price.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsNumber, IsObject } from 'class-validator';

export class UpdateProductPriceDto extends PartialType(CreateProductPriceDto) {
    @ApiPropertyOptional({ description: 'فعال/غیرفعال' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiPropertyOptional({ description: 'قیمت پایه' })
    @IsOptional()
    @IsNumber()
    base_price_amount?: number;

    @ApiPropertyOptional({ description: 'ضریب تبدیل به واحد اصلی' })
    @IsOptional()
    @IsNumber()
    conversion_rate?: number;

    @ApiPropertyOptional({ description: 'درصد تغییر قیمت (مثبت برای افزایش، منفی برای کاهش)' })
    @IsOptional()
    @IsNumber()
    custom_adjustment_percent?: number;

    @ApiPropertyOptional({ description: 'تنظیمات اختصاصی شرط' })
    @IsOptional()
    @IsObject()
    condition_config?: any;
}