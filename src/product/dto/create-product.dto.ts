// src/products/dto/create-product.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString, IsNumber, IsOptional, IsBoolean, IsEnum,
    IsArray, ValidateNested, IsObject
} from 'class-validator';
import { SellUnit, Language } from '@prisma/client';
import { Type } from 'class-transformer';
import { CreateProductPriceDto } from '../../product-price/dto/create-product-price.dto';

export class CreateProductContentDto {
    @ApiProperty({ enum: Language })
    @IsEnum(Language)
    language: Language;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    category_name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    sub_category_name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    super_category_name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    brand_name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    city_name?: string;

    @ApiPropertyOptional()
    @IsObject()
    @IsOptional()
    technical_specs?: Record<string, any>;

    @ApiPropertyOptional()
    @IsString({ each: true })
    @IsOptional()
    features?: string[];

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    auto_translated?: boolean;
}

export class CreateProductDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsNumber()
    stock: number;

    @ApiProperty()
    @IsNumber()
    min_sale_amount: number;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    address?: string;

    @ApiProperty({ enum: SellUnit })
    @IsEnum(SellUnit)
    unit: SellUnit;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    category_id?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    sub_category_id?: string;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    is_brands_representative?: boolean;

    // 🔥 سیستم لوکیشن جدید
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    location_level_1_id?: string; // کشور

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    location_level_2_id?: string; // استان

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    location_level_3_id?: string; // شهر

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    location_level_4_id?: string; // منطقه

    @ApiProperty()
    @IsString()
    account_id: string;

    // 🔥 ارتباط با کاتالوگ
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    catalog_id?: string;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    is_based_on_catalog?: boolean = false;

    @ApiPropertyOptional({
        type: [CreateProductPriceDto],
        description: 'لیست قیمت‌های محصول'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateProductPriceDto)
    prices?: CreateProductPriceDto[];

    @ApiPropertyOptional({ type: [CreateProductContentDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateProductContentDto)
    contents?: CreateProductContentDto[];
}