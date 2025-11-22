// src/conversations/dto/conversation-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ConversationQueryDto {
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
        default: 20
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiProperty({
        description: 'فقط مکالمات دارای پیام نخوانده',
        required: false,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    unread_only?: boolean = false;
}