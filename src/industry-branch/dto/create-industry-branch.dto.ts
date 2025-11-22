import { IsString, IsOptional, IsNumber, IsNotEmpty, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';

export class CreateIndustryBranchDto {
    @ApiProperty({ example: '8' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({ example: 1, required: false })
    @IsNumber()
    @IsOptional()
    level?: number;

    @ApiProperty({ example: '65a1b2c3d4e5f6a1b2c3d4e5', required: false })
    @IsString()
    @IsOptional()
    parentId?: string;

    @ApiProperty({ example: '15000000', required: false })
    @IsString()
    @IsOptional()
    department_code?: string;

    @ApiProperty({ example: '4969', required: false })
    @IsString()
    @IsOptional()
    business_tree_code?: string;

    // 🔥 فیلدهای چندزبانه
    @ApiProperty({ example: 'فرهنگ و هنر' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'شاخه فرهنگ و هنر', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'وزارت فرهنگ و ارشاد اسلامی', required: false })
    @IsString()
    @IsOptional()
    department?: string;

    @ApiProperty({ enum: Language, required: false, default: 'fa' })
    @IsOptional()
    @IsEnum(Language)
    language?: Language;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean;
}