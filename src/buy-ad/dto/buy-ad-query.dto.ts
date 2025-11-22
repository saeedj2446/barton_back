
// src/buy-ad/dto/buy-ad-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { BuyAdStatus, BuyAdType, Language } from '@prisma/client';

export class BuyAdQueryDto {
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
    @IsString()
    @IsOptional()
    search?: string;

    @ApiProperty({ enum: BuyAdStatus, required: false })
    @IsEnum(BuyAdStatus)
    @IsOptional()
    status?: BuyAdStatus;

    @ApiProperty({ enum: BuyAdType, required: false })
    @IsEnum(BuyAdType)
    @IsOptional()
    type?: BuyAdType;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    category_id?: number;

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

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    location_level_4_id?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    min_amount?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    max_amount?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    unit?: string;

    @ApiProperty({ enum: Language, required: false, default: Language.fa })
    @IsEnum(Language)
    @IsOptional()
    language?: Language;

    @ApiProperty({
        required: false,
        enum: ['newest', 'oldest', 'most_offers', 'urgent', 'amount_high', 'amount_low'],
        default: 'newest',
    })
    @IsString()
    @IsOptional()
    sort_by?: string = 'newest';
}