// src/accounts/dto/create-account.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, IsEnum, ValidateNested } from 'class-validator';
import { AccountActivityType, Language } from '@prisma/client';
import { Type } from 'class-transformer';

// در AccountContentDto - حذف فیلدهای اضافی
export class AccountContentDto {
    @ApiProperty({ enum: Language, description: 'زبان محتوا' })
    @IsEnum(Language)
    language: Language;

    @ApiProperty({ description: 'نام حساب به این زبان' })
    @IsString()
    name: string;

    @ApiProperty({ required: false, description: 'توضیحات حساب' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false, description: 'توضیحات پروفایل' })
    @IsString()
    @IsOptional()
    profile_description?: string;

    @ApiProperty({ required: false, description: 'سابقه فعالیت مرتبط' })
    @IsString()
    @IsOptional()
    related_activity_history?: string;

    @ApiProperty({ required: false, default: true, description: 'آیا به صورت خودکار ترجمه شده؟' })
    @IsBoolean()
    @IsOptional()
    auto_translated?: boolean = true;
}

export class CreateAccountDto {
    @ApiProperty({
        type: [AccountContentDto],
        description: 'محتوای چندزبانه حساب'
    })
    @ValidateNested({ each: true })
    @Type(() => AccountContentDto)
    contents: AccountContentDto[];

    @ApiProperty({
        enum: AccountActivityType,
        description: 'نوع فعالیت حساب'
    })
    @IsEnum(AccountActivityType)
    activity_type: AccountActivityType;

    @ApiProperty({ required: false, description: 'شناسه صنف' })
    @IsString()
    @IsOptional()
    industryId?: string;

    @ApiProperty({ required: false, description: 'تگ‌های تخصصی کسب‌وکار' })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    business_tags?: string[];

    // 🔥 سیستم لوکیشن جدید
    @ApiProperty({ required: false, description: 'شناسه لوکیشن سطح 1 (کشور)' })
    @IsString()
    @IsOptional()
    location_level_1_id?: string;

    @ApiProperty({ required: false, description: 'شناسه لوکیشن سطح 2 (استان)' })
    @IsString()
    @IsOptional()
    location_level_2_id?: string;

    @ApiProperty({ required: false, description: 'شناسه لوکیشن سطح 3 (شهر)' })
    @IsString()
    @IsOptional()
    location_level_3_id?: string;

    @ApiProperty({ required: false, description: 'شناسه لوکیشن سطح 4 (منطقه)' })
    @IsString()
    @IsOptional()
    location_level_4_id?: string;

    @ApiProperty({ required: false, description: 'شماره تلفن عمومی' })
    @IsString()
    @IsOptional()
    public_phone?: string;

    @ApiProperty({ required: false, description: 'تعداد پرسنل' })
    @IsString()
    @IsOptional()
    human_resource_count?: string;


    @ApiProperty({ required: false, description: 'کد پستی' })
    @IsString()
    @IsOptional()
    postal_code?: string;

    @ApiProperty({ required: false, description: 'شماره شبا' })
    @IsString()
    @IsOptional()
    shaba_code?: string;

    @ApiProperty({ required: false, description: 'آیا شرکت است؟' })
    @IsBoolean()
    @IsOptional()
    is_company?: boolean;


    @ApiProperty({ required: false, description: 'شماره ثبت شرکت' })
    @IsString()
    @IsOptional()
    company_register_code?: string;

}