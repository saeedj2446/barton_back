// src/buy-ad/dto/offer-settings.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsNumber, IsOptional, IsObject, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethodType } from '@prisma/client';

export class BudgetRangeDto {
    @ApiProperty({ required: false, description: 'حداقل بودجه' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    min?: number;

    @ApiProperty({ required: false, description: 'حداکثر بودجه' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    max?: number;
}

export class OfferSettingsDto {
    @ApiProperty({
        required: false,
        default: true,
        description: 'آیا همه می‌توانند پیشنهاد دهند؟'
    })
    @IsBoolean()
    @IsOptional()
    allow_public_offers?: boolean = true;

    @ApiProperty({
        required: false,
        type: [String],
        description: 'فقط صنف‌های خاص'
    })
    @IsArray()
    @IsOptional()
    allowed_categories?: string[];

    @ApiProperty({
        required: false,
        minimum: 1,
        maximum: 5,
        description: 'حداقل امتیاز فروشنده'
    })
    @IsNumber()
    @Min(1)
    @Max(5)
    @IsOptional()
    min_seller_rating?: number;

    @ApiProperty({
        required: false,
        type: BudgetRangeDto,
        description: 'محدوده بودجه'
    })
    @ValidateNested()
    @Type(() => BudgetRangeDto)
    @IsOptional()
    budget_range?: BudgetRangeDto;

    @ApiProperty({
        required: false,
        description: 'حداکثر زمان تحویل (روز)'
    })
    @IsNumber()
    @Min(1)
    @IsOptional()
    max_delivery_days?: number;

    @ApiProperty({
        required: false,
        type: [String],
        description: 'گواهی‌های مورد نیاز'
    })
    @IsArray()
    @IsOptional()
    required_certifications?: string[];

    @ApiProperty({
        required: false,
        enum: PaymentMethodType,
        isArray: true,
        description: 'روش‌های پرداخت قابل قبول'
    })
    @IsArray()
    @IsOptional()
    payment_methods?: PaymentMethodType[];

    @ApiProperty({
        required: false,
        default: 7,
        description: 'پیشنهادات بعد از چند روز منقضی شوند'
    })
    @IsNumber()
    @Min(1)
    @IsOptional()
    auto_expire_days?: number = 7;
}