// src/plan/dto/create-plan.dto.ts
import { IsString, IsNumber, IsArray, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlanStatus } from '@prisma/client';

export class CreatePlanDto {
    @ApiProperty({ example: 'پلن حرفه‌ای' })
    @IsString()
    name: string;

    @ApiProperty({ example: 2 })
    @IsNumber()
    level: number;

    @ApiProperty({ example: 'پلن مناسب برای کسب‌وکارهای متوسط' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 100000 })
    @IsNumber()
    price: number;

    @ApiProperty({ example: 100000 })
    @IsNumber()
    credit_amount: number;

    @ApiProperty({ example: 20000 })
    @IsNumber()
    @IsOptional()
    bonus_credit?: number;

    @ApiProperty({ example: 30 })
    @IsNumber()
    expiry_days: number;

    @ApiProperty({ example: ['پشتیبانی تلفنی', 'نمایش ویژه'] })
    @IsArray()
    @IsOptional()
    benefits?: string[];

    @ApiProperty({ example: false })
    @IsBoolean()
    @IsOptional()
    is_popular?: boolean;
}