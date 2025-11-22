// src/reviews/dto/create-review.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max, IsBoolean } from 'class-validator';

export class CreateReviewDto {
    @ApiProperty({ description: 'امتیاز (1 تا 5)', minimum: 1, maximum: 5 })
    @IsNumber()
    @Min(1)
    @Max(5)
    rating_score: number;

    @ApiProperty({ description: 'متن نظر', required: false })
    @IsString()
    @IsOptional()
    comment?: string;

    @ApiProperty({ description: 'شناسه محصول', required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ description: 'شناسه حساب', required: false })
    @IsString()
    @IsOptional()
    account_id?: string;
}



