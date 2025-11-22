// src/conversations/dto/create-conversation.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, MinLength } from 'class-validator';

export class CreateConversationDto {
    @ApiProperty({
        description: 'آیدی کاربر مقابل',
        example: '507f1f77bcf86cd799439011'
    })
    @IsString()
    @IsNotEmpty()
    user2_id: string;

    @ApiProperty({
        description: 'آیدی آگهی خرید (اختیاری)',
        required: false,
        example: '507f1f77bcf86cd799439012'
    })
    @IsOptional()
    @IsString()
    buy_ad_id?: string;

    @ApiProperty({
        description: 'پیام اولیه (اختیاری)',
        required: false,
        example: 'سلام، درباره آگهی خرید شما سوال دارم'
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    initial_message?: string;
}