// src/brands/dto/update-brand.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BrandType, ManufacturerType } from '@prisma/client';
import {
  IsString, IsEnum, IsOptional, IsBoolean, IsArray, ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBrandContentDto } from './create-brand.dto';

export class UpdateBrandDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;

  @ApiPropertyOptional({ type: [CreateBrandContentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBrandContentDto)
  contents?: CreateBrandContentDto[];
}