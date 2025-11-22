// src/product/dto/boost-product.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max, IsString } from 'class-validator';

export class BoostProductDto {
    @ApiProperty({
        description: 'توان بوست (تعداد واحدها)',
        minimum: 1,
        maximum: 10,
        example: 3
    })
    @IsNumber()
    @Min(1)
    @Max(10)
    boost_power: number;

    @ApiProperty({
        description: 'مدت زمان بوست به ماه',
        minimum: 1,
        maximum: 12,
        example: 3
    })
    @IsNumber()
    @Min(1)
    @Max(12)
    duration_months: number;

    @ApiProperty({ required: false, description: 'توضیح دلخواه برای فعالیت' })
    @IsString()
    @IsOptional()
    description?: string;
}