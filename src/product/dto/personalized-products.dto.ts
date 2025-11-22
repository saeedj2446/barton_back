// src/product/dto/personalized-products.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class PersonalizedProductsDto {
    @ApiProperty({
        description: 'تعداد محصولات پیشنهادی',
        required: false,
        default: 20
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiProperty({
        description: 'فقط محصولات بوست شده',
        required: false,
        default: false
    })
    @IsOptional()
    only_boosted?: boolean = false;
}