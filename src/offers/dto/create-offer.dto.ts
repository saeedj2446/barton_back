// src/offers/dto/create-offer.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNumber,
    IsOptional,
    IsArray,
    IsEnum,
    Min,
    Max,
    ValidateNested, IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';
import { OfferType, OfferPriority, PaymentMethodType, Language } from '@prisma/client';

export class CreateOfferContentDto {
    @ApiProperty({ enum: Language })
    @IsEnum(Language)
    language: Language;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    packaging_details?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    certifications_note?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    shipping_note?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean = true;
}

export class CreateOfferDto {
    @ApiProperty()
    @IsString()
    buy_ad_id: string;

    @ApiProperty()
    @IsString()
    account_id: string;

    @ApiProperty()
    @IsNumber()
    @Min(1)
    proposed_price: number;

    @ApiProperty()
    @IsNumber()
    @Min(1)
    proposed_amount: number;

    @ApiProperty()
    @IsString()
    unit: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(1)
    @IsOptional()
    delivery_time?: number;

    @ApiProperty({ enum: OfferType, required: false })
    @IsEnum(OfferType)
    @IsOptional()
    type?: OfferType;

    @ApiProperty({ enum: OfferPriority, required: false })
    @IsEnum(OfferPriority)
    @IsOptional()
    priority?: OfferPriority;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(1)
    @IsOptional()
    validity_hours?: number;

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

    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsOptional()
    certifications?: string[];

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    warranty_months?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    quality_guarantee?: boolean;

    @ApiProperty({ type: [CreateOfferContentDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateOfferContentDto)
    contents?: CreateOfferContentDto[];
}