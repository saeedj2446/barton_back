// src/brands/dto/brand-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BrandType, ManufacturerType } from '@prisma/client';
import {IsOptional, IsString, IsEnum, IsNumber, Min, IsBoolean} from 'class-validator';
import { Type } from 'class-transformer';

export class BrandQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: BrandType })
    @IsOptional()
    @IsEnum(BrandType)
    brand_type?: BrandType;

    @ApiPropertyOptional({ enum: ManufacturerType })
    @IsOptional()
    @IsEnum(ManufacturerType)
    manufacturer_type?: ManufacturerType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    industry_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    is_verified?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    limit?: number = 50;
}