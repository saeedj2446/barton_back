// src/brands/dto/brand-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BrandType, ManufacturerType } from '@prisma/client';

export class BrandContentResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    language: string;

    @ApiProperty()
    name: string;

    @ApiPropertyOptional()
    description?: string;

    @ApiProperty()
    auto_translated: boolean;
}

export class BrandResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    created_at: Date;

    @ApiProperty()
    updated_at: Date;

    @ApiPropertyOptional()
    logo?: string;

    @ApiProperty({ enum: BrandType })
    brand_type: BrandType;

    @ApiProperty({ enum: ManufacturerType })
    manufacturer_type: ManufacturerType;

    @ApiPropertyOptional()
    country?: string;

    @ApiPropertyOptional()
    website?: string;

    @ApiPropertyOptional()
    region?: string;

    @ApiProperty()
    is_verified: boolean;

    @ApiProperty()
    is_system_brand: boolean;

    @ApiPropertyOptional()
    industry_id?: string;

    @ApiPropertyOptional()
    account_id?: string;

    @ApiProperty()
    products_count: number;

    @ApiProperty({ type: [BrandContentResponseDto] })
    contents: BrandContentResponseDto[];
}