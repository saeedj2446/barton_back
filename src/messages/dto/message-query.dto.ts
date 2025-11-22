// src/messages/dto/message-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageQueryDto {
    @ApiProperty({
        description: 'شماره صفحه',
        required: false,
        default: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        description: 'تعداد در هر صفحه',
        required: false,
        default: 50
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 50;

    @ApiProperty({
        description: 'دریافت پیام‌های قبل از تاریخ مشخص (برای اسکرول بی‌نهایت)',
        required: false,
        example: '2024-01-15T10:30:00.000Z'
    })
    @IsOptional()
    @IsDateString()
    before?: string;
}