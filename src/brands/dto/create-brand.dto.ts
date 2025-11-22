// src/brands/dto/create-brand.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BrandType, ManufacturerType, Language } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsString, IsEnum, IsOptional, IsBoolean, IsArray, ValidateNested
} from 'class-validator';

export class CreateBrandContentDto {
    @ApiProperty({ enum: Language })
    @IsEnum(Language)
    language: Language;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean;
}

export class CreateBrandDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    logo?: string;

    @ApiProperty({ enum: BrandType })
    @IsEnum(BrandType)
    brand_type: BrandType;

    @ApiProperty({ enum: ManufacturerType })
    @IsEnum(ManufacturerType)
    manufacturer_type: ManufacturerType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    website?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    region?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    industry_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    account_id?: string;

    @ApiProperty({ type: [CreateBrandContentDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateBrandContentDto)
    contents: CreateBrandContentDto[];
}