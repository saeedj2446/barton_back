// src/offers/dto/counter-offer.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, IsArray } from 'class-validator';

export class CounterOfferDto {
    @ApiProperty()
    @IsNumber()
    @Min(1)
    proposed_price: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(1)
    @IsOptional()
    delivery_time?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    shipping_cost?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(1)
    @IsOptional()
    shipping_time?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    warranty_months?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(1)
    @IsOptional()
    validity_hours?: number;

    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsOptional()
    certifications?: string[];
}