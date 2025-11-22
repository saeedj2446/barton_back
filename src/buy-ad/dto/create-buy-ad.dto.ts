// src/buy-ad/dto/create-buy-ad.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsArray,
    IsEnum,
    ValidateNested,
    Min,
    Max
} from 'class-validator';
import { Type } from 'class-transformer';
import {
    BuyAdType,
    PaymentMethodType,
    Language
} from '@prisma/client';

export class BuyAdContentDto {
    @ApiProperty({ enum: Language })
    @IsEnum(Language)
    language: Language;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    category_name?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    subcategory_name?: string;

    @ApiProperty({ required: false, default: true })
    @IsBoolean()
    @IsOptional()
    auto_translated?: boolean;
}

export class CreateBuyAdDto {
    @ApiProperty()
    @IsNumber()
    @Min(1)
    requirement_amount: number;

    @ApiProperty()
    @IsString()
    unit: string;

    @ApiProperty({ enum: BuyAdType, default: BuyAdType.SIMPLE })
    @IsEnum(BuyAdType)
    @IsOptional()
    type?: BuyAdType;

    @ApiProperty()
    @IsString()
    account_id: string;

    // لوکیشن‌ها
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

    // تنظیمات تماس
    @ApiProperty({ default: true })
    @IsBoolean()
    @IsOptional()
    allow_phone_contact?: boolean;

    @ApiProperty({ default: true })
    @IsBoolean()
    @IsOptional()
    allow_message_contact?: boolean;

    @ApiProperty({ default: true })
    @IsBoolean()
    @IsOptional()
    allow_public_offers?: boolean;

    // شرایط
    @ApiProperty({ required: false })
    @IsNumber()
    @Min(1)
    @Max(5)
    @IsOptional()
    min_seller_rating?: number;

    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsOptional()
    required_certifications?: string[];

    @ApiProperty({ required: false, enum: PaymentMethodType, isArray: true })
    @IsArray()
    @IsOptional()
    preferred_payment_methods?: PaymentMethodType[];

    // تاریخ انقضا
    @ApiProperty({ required: false })
    @IsOptional()
    expires_at?: Date;

    // محتوای چندزبانه
    @ApiProperty({ type: [BuyAdContentDto] })
    @ValidateNested({ each: true })
    @Type(() => BuyAdContentDto)
    contents: BuyAdContentDto[];
}