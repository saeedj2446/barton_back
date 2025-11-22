// src/units/dto/create-unit.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUnitContentDto {
    @ApiProperty({ enum: Language })
    @IsString()
    language: Language;

    @ApiProperty()
    @IsString()
    label: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean;
}

export class CreateUnitDto {
    @ApiProperty()
    @IsString()
    key: string;

    @ApiProperty()
    @IsString()
    symbol: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    rate?: number = 1;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isBase?: boolean = false;

    @ApiPropertyOptional({ type: [CreateUnitContentDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateUnitContentDto)
    contents?: CreateUnitContentDto[];
}