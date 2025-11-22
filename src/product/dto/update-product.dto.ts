// src/product/dto/update-product.dto.ts
import {ApiPropertyOptional, PartialType} from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';
import {IsEnum, IsBoolean, IsOptional, IsNumber, IsDate, IsArray, ValidateNested} from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {CreateProductPriceDto} from "../../product-price/dto/create-product-price.dto";

export class UpdateProductDto extends PartialType(CreateProductDto) {
    @ApiProperty({ enum: ProductStatus, required: false })
    @IsEnum(ProductStatus)
    @IsOptional()
    status?: ProductStatus;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    confirmed?: boolean;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    boost_is_elevated?: boolean;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    boost_purchased?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    boost_power?: number;

    @ApiProperty({ required: false })
    @IsDate()
    @Type(() => Date)
    @IsOptional()
    boost_expires_at?: Date;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    total_views?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    total_likes?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    total_saves?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    has_video?: boolean;

    // 🔥 فیلدهای قیمت جدید
    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    base_min_price?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    base_max_price?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    calculated_min_price?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    calculated_max_price?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    has_any_discount?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    best_discount_percent?: number;

    // 🔥 جدید: اضافه کردن فیلد prices برای آپدیت قیمت‌ها
    @ApiPropertyOptional({
        type: [CreateProductPriceDto],
        description: 'لیست قیمت‌های محصول برای به‌روزرسانی'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateProductPriceDto)
    prices?: CreateProductPriceDto[];
}