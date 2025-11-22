// src/specs/dto/create-spec.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import {
    IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSpecContentDto {
    @ApiProperty({ enum: Language })
    @IsString()
    language: Language;

    @ApiProperty()
    @IsString()
    label: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean;
}

export class CreateSpecDto {
    @ApiProperty()
    @IsString()
    key: string;

    @ApiProperty()
    @IsString()
    type: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    data_type?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    is_required?: boolean = false;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    is_filterable?: boolean = true;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    is_searchable?: boolean = false;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    sort_order?: number = 0;

    @ApiPropertyOptional()
    @IsOptional()
    options?: any;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    min_value?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    max_value?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    step?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowed_unit_keys?: string[];

    @ApiPropertyOptional({ type: [CreateSpecContentDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSpecContentDto)
    contents?: CreateSpecContentDto[];
}