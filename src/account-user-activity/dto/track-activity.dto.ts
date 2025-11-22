// src/account-user-activity/dto/track-activity.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {IsString, IsEnum, IsOptional, IsNumber, IsObject, IsArray, ValidateNested} from 'class-validator';
import { UserActivityType } from '@prisma/client';
import {Type} from "class-transformer";

export class TrackActivityDto {
    @ApiProperty({ description: 'شناسه کاربر-اکانت' })
    @IsString()
    account_user_id: string;

    @ApiProperty({ enum: UserActivityType, description: 'نوع فعالیت' })
    @IsEnum(UserActivityType)
    activity_type: UserActivityType;

    @ApiProperty({ description: 'نوع هدف فعالیت', required: false })
    @IsString()
    @IsOptional()
    target_type?: string;

    @ApiProperty({ description: 'شناسه هدف فعالیت', required: false })
    @IsString()
    @IsOptional()
    target_id?: string;

    @ApiProperty({
        description: 'متادیتای فعالیت',
        required: false,
        type: Object, // ✅ اصلاح: استفاده از Object به جای 'object'
    })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>; // ✅ تغییر به Record برای انعطاف‌پذیری

    @ApiProperty({ description: 'وزن فعالیت', required: false, default: 1 })
    @IsNumber()
    @IsOptional()
    weight?: number;

    @ApiProperty({ description: 'شناسه محصول', required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ description: 'شناسه دسته‌بندی', required: false })
    @IsString()
    @IsOptional()
    category_id?: string;

    @ApiProperty({ description: 'IP کاربر', required: false })
    @IsString()
    @IsOptional()
    ip_address?: string;

    @ApiProperty({ description: 'User Agent', required: false })
    @IsString()
    @IsOptional()
    user_agent?: string;
}

export class TrackBatchActivitiesDto {
    @ApiProperty({ type: [TrackActivityDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TrackActivityDto)
    activities: TrackActivityDto[];
}