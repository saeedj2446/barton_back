// src/product/dto/product-query.dto.ts - نسخه بهینه‌شده
import { ApiProperty } from '@nestjs/swagger';
import {
    IsNumber,
    IsOptional,
    IsString,
    Min,
    IsEnum,
    IsBoolean, Max
} from 'class-validator';
import { Type } from 'class-transformer';
import {
    ProductStatus,
    AccountActivityType,
    PaymentMethodType,
    PricingConditionCategory,
    PricingConditionType,
    SellUnit
} from '@prisma/client';

export class ProductQueryDto {
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

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    category_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    sub_category_id?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    province_id?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    city_id?: number;

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
        default: true,
        description: 'فقط محصولات تأیید شده'
    })
    @IsBoolean()
    @IsOptional()
    confirmed?: boolean = true;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    has_video?: boolean;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_id?: string;

    @ApiProperty({
        required: false,
        enum: ['boost', 'newest', 'price_low', 'price_high', 'popular', 'most_liked', 'most_saved'],
        default: 'boost',
    })
    @IsString()
    @IsOptional()
    sort_by?: string = 'boost';

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    only_boosted?: boolean = false;

    @ApiProperty({ required: false })
    @IsEnum(AccountActivityType)
    @IsOptional()
    account_activity_type?: AccountActivityType;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    min_stock?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    unit?: string;

    @ApiProperty({
        required: false,
        default: true,
        description: 'فقط محصولات دارای تصویر'
    })
    @IsBoolean()
    @IsOptional()
    has_images?: boolean = true;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    brand_name?: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    is_brands_representative?: boolean;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    user_id?: string;

    @ApiProperty({ enum: ProductStatus, required: false })
    @IsEnum(ProductStatus)
    @IsOptional()
    status?: ProductStatus;

    @ApiProperty({
        required: false,
        enum: PaymentMethodType,
        description: 'فیلتر بر اساس روش پرداخت'
    })
    @IsEnum(PaymentMethodType)
    @IsOptional()
    payment_method?: PaymentMethodType;

    @ApiProperty({
        required: false,
        description: 'حداقل امتیاز محصول',
        minimum: 1,
        maximum: 5
    })
    @IsNumber()
    @Min(1)
    @Max(5)
    @IsOptional()
    min_rating?: number;

    // 🔥 فیلدهای جدید برای سیستم قیمت‌گذاری پیشرفته
    @ApiProperty({
        required: false,
        enum: PricingConditionType,
        description: 'فیلتر بر اساس نوع شرط قیمت‌گذاری'
    })
    @IsEnum(PricingConditionType)
    @IsOptional()
    condition_type?: PricingConditionType;

    @ApiProperty({
        required: false,
        enum: PricingConditionCategory,
        description: 'فیلتر بر اساس دسته شرط قیمت‌گذاری'
    })
    @IsEnum(PricingConditionCategory)
    @IsOptional()
    condition_category?: PricingConditionCategory;

    @ApiProperty({
        required: false,
        enum: SellUnit,
        description: 'فیلتر بر اساس واحد قیمت'
    })
    @IsEnum(SellUnit)
    @IsOptional()
    price_unit?: SellUnit;

    @ApiProperty({
        required: false,
        description: 'فیلتر بر اساس تخفیف'
    })
    @IsBoolean()
    @IsOptional()
    has_discount?: boolean;
}