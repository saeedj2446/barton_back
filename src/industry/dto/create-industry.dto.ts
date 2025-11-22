import { IsString, IsArray, IsOptional, IsNumber, IsBoolean, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IndustryBusinessType, Language } from '@prisma/client';

export class CreateIndustryDto {
    @ApiProperty({ example: '1234567890' })
    @IsString()
    @IsOptional()
    business_number?: string;

    @ApiProperty({ example: 'صنف نمونه' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'توضیحات صنف نمونه', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'معرفی کامل صنف نمونه', required: false })
    @IsString()
    @IsOptional()
    introduction?: string;

    @ApiProperty({ example: ['تگ۱', 'تگ۲'], required: false })
    @IsArray()
    @IsOptional()
    business_tags?: string[];

    @ApiProperty({ example: ['تگ مرتبط۱', 'تگ مرتبط۲'], required: false })
    @IsArray()
    @IsOptional()
    related_tags?: string[];

    @ApiProperty({ example: ['HOUSEHOLD', 'SERVICE'], enum: IndustryBusinessType, isArray: true })
    @IsArray()
    @IsEnum(IndustryBusinessType, { each: true })
    business_type: IndustryBusinessType[];

    @ApiProperty({ example: ['محصول خرید۱'], required: false })
    @IsArray()
    @IsOptional()
    buy_products?: string[];

    @ApiProperty({ example: ['محصول فروش۱'], required: false })
    @IsArray()
    @IsOptional()
    sell_products?: string[];

    @ApiProperty({ example: 1, required: false })
    @IsNumber()
    @IsOptional()
    level?: number;

    @ApiProperty({ example: 0, required: false })
    @IsNumber()
    @IsOptional()
    priority1?: number;

    @ApiProperty({ example: 0, required: false })
    @IsNumber()
    @IsOptional()
    priority2?: number;

    @ApiProperty({ example: 0, required: false })
    @IsNumber()
    @IsOptional()
    priority3?: number;

    @ApiProperty({ example: true, required: false })
    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @ApiProperty({ example: '65a1b2c3d4e5f6a1b2c3d4e5', required: false })
    @IsString()
    @IsOptional()
    industry_branch_id?: string;

    @ApiProperty({ example: '65a1b2c3d4e5f6a1b2c3d4e5', required: false })
    @IsString()
    @IsOptional()
    parentId?: string;

    @ApiProperty({ enum: Language, required: false, default: Language.fa })
    @IsEnum(Language)
    @IsOptional()
    language?: Language = Language.fa;

    @ApiProperty({ example: false, required: false })
    @IsBoolean()
    @IsOptional()
    auto_translated?: boolean = false;
}