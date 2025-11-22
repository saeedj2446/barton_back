// src/catalogs/dto/create-catalog.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogStatus, SellUnit, Language } from '@prisma/client';
import {
    IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsEnum
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCatalogContentDto {
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

export class CreateCatalogSpecDto {
    @ApiProperty()
    @IsString()
    spec_id: string;

    @ApiProperty()
    @IsString()
    value: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    spec_type?: string = 'GENERAL';
}

export class CreateCatalogDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    model_number?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sku_pattern?: string;

    @ApiPropertyOptional({ enum: CatalogStatus })
    @IsOptional()
    @IsEnum(CatalogStatus)
    status?: CatalogStatus = CatalogStatus.DRAFT;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    is_public?: boolean = false;

    @ApiProperty()
    @IsString()
    brand_id: string;

    @ApiProperty()
    @IsString()
    category_id: string;

    @ApiProperty()
    @IsString()
    manufacturer_account_id: string;

    @ApiProperty({ enum: SellUnit })
    @IsEnum(SellUnit)
    sell_unit: SellUnit;

    @ApiPropertyOptional()
    @IsOptional()
    spect_units?: any;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    images?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    documents?: string[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    video_url?: string;

    @ApiPropertyOptional()
    @IsOptional()
    special_specs?: any;

    @ApiProperty({ type: [CreateCatalogContentDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateCatalogContentDto)
    contents: CreateCatalogContentDto[];

    @ApiPropertyOptional({ type: [CreateCatalogSpecDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateCatalogSpecDto)
    catalog_specs?: CreateCatalogSpecDto[];
}