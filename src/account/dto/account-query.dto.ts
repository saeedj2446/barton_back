// src/accounts/dto/account-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, IsEnum, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AccountActivityType, Language } from '@prisma/client';

export class AccountQueryDto {
    @ApiProperty({ required: false, default: 1 })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiProperty({ required: false, default: 10 })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @IsOptional()
    limit?: number = 10;

    @ApiProperty({ required: false })
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @ApiProperty({ required: false })
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    @IsOptional()
    confirmed?: boolean;

    @ApiProperty({ required: false, enum: AccountActivityType })
    @IsEnum(AccountActivityType)
    @IsOptional()
    activity_type?: AccountActivityType;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    industryId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location_level_1_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location_level_2_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location_level_3_id?: string;

    // 🔥 فیلد زبان برای جستجوی چندزبانه
    @ApiProperty({ required: false, enum: Language, default: Language.fa })
    @IsEnum(Language)
    @IsOptional()
    language?: Language = Language.fa;
}