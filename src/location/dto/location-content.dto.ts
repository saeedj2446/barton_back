// src/locations/dto/location-content.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Language } from '@prisma/client';

export class CreateLocationContentDto {
    @ApiProperty({ enum: Language })
    @IsEnum(Language)
    language: Language;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    full_name?: string;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean = false;
}

export class UpdateLocationContentDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    full_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean;
}