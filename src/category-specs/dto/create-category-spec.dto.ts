// src/category-specs/dto/create-category-spec.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCategorySpecDto {
    @ApiProperty({
        description: 'شناسه دسته‌بندی',
        example: '507f1f77bcf86cd799439011'
    })
    @IsString()
    category_id: string;

    @ApiProperty({
        description: 'شناسه مشخصه فنی',
        example: '507f1f77bcf86cd799439012'
    })
    @IsString()
    spec_id: string;
}

export class CreateCategorySpecBulkDto {
    @ApiProperty({
        description: 'لیست ارتباطات دسته‌بندی و مشخصه فنی',
        type: [CreateCategorySpecDto]
    })
    relationships: CreateCategorySpecDto[];
}