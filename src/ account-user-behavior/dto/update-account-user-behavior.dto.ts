import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsArray, IsNumber, IsDate } from 'class-validator';

export class UpdateAccountUserBehaviorDto {
    @ApiProperty({ description: 'علاقه‌مندی‌های کاربر', required: false })
    @IsObject()
    @IsOptional()
    interests?: any;

    @ApiProperty({ description: 'الگوهای جستجو', required: false })
    @IsObject()
    @IsOptional()
    search_patterns?: any;

    @ApiProperty({ description: 'جستجوهای اخیر', required: false })
    @IsArray()
    @IsOptional()
    recent_searches?: string[];

    @ApiProperty({ description: 'مشاهدات اخیر', required: false })
    @IsArray()
    @IsOptional()
    recent_views?: string[];

    @ApiProperty({ description: 'ذخیره‌های اخیر', required: false })
    @IsArray()
    @IsOptional()
    recent_saves?: string[];

    @ApiProperty({ description: 'تعداد کل جستجوها', required: false })
    @IsNumber()
    @IsOptional()
    total_searches?: number;

    @ApiProperty({ description: 'تعداد کل مشاهده‌ها', required: false })
    @IsNumber()
    @IsOptional()
    total_views?: number;

    @ApiProperty({ description: 'تعداد کل ذخیره‌ها', required: false })
    @IsNumber()
    @IsOptional()
    total_saves?: number;

    // ✅ اضافه کردن last_active
    @ApiProperty({ description: 'آخرین فعالیت کاربر', required: false })
    @IsDate()
    @IsOptional()
    last_active?: Date;
}