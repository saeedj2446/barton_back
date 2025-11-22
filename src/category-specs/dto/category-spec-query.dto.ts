// src/category-specs/dto/category-spec-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CategorySpecQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    spec_id?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number = 1;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number = 50;
}