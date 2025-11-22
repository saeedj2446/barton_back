// src/brands/dto/brand-content.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { IsEnum, IsString, IsOptional, IsBoolean } from 'class-validator';

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

export class UpdateBrandContentDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean;
}