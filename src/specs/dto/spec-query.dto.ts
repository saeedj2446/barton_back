// src/specs/dto/spec-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SpecQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    is_filterable?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    is_required?: boolean;

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