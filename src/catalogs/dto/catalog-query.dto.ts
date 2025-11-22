// src/catalogs/dto/catalog-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogStatus } from '@prisma/client';
import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CatalogQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    brand_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    manufacturer_account_id?: string;

    @ApiPropertyOptional({ enum: CatalogStatus })
    @IsOptional()
    @IsEnum(CatalogStatus)
    status?: CatalogStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    is_public?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    limit?: number = 50;
}