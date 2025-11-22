// src/offers/dto/offer-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { OfferStatus } from '@prisma/client';

export class OfferQueryDto {
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

    @ApiProperty({ enum: OfferStatus, required: false })
    @IsEnum(OfferStatus)
    @IsOptional()
    status?: OfferStatus;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    buy_ad_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    user_id?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    min_price?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    max_price?: number;

    @ApiProperty({
        required: false,
        enum: ['newest', 'oldest', 'price_low', 'price_high', 'delivery_fast'],
        default: 'newest',
    })
    @IsString()
    @IsOptional()
    sort_by?: string = 'newest';
}