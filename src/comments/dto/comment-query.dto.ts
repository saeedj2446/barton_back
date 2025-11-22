// src/comments/dto/comment-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CommentQueryDto {
    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    limit?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    parent_id?: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    include_replies?: boolean;

    @ApiProperty({
        description: 'فیلتر بر اساس وضعیت تأیید',
        required: false
    })
    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    confirmed?: boolean;

    // 🔥 اضافه کردن فیلد user_id
    @ApiProperty({
        description: 'فیلتر بر اساس کاربر',
        required: false
    })
    @IsString()
    @IsOptional()
    user_id?: string;
}