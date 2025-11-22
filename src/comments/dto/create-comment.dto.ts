// src/comments/dto/create-comment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateCommentDto {
    @ApiProperty({ description: 'متن کامنت' })
    @IsString()
    content: string;

    @ApiProperty({ description: 'شناسه والد (برای پاسخ)', required: false })
    @IsString()
    @IsOptional()
    parent_id?: string;

    @ApiProperty({ description: 'شناسه محصول', required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ description: 'شناسه حساب', required: false })
    @IsString()
    @IsOptional()
    account_id?: string;
}

