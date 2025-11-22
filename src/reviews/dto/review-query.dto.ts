// src/reviews/dto/review-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ReviewQueryDto {
    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    limit?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

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
    @Type(() => Number)
    min_rating?: number;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    confirmed?: boolean;
}