// src/categories/dto/create-category.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsInt, IsBoolean, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Language } from '@prisma/client';

export class CategoryContentDto {
    @ApiProperty({ enum: Language })
    @IsEnum(Language)
    language: Language;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    metadata?: any;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    auto_translated?: boolean = true;
}

export class CreateCategoryDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parent_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    bId?: number;

    @ApiProperty({ required: false, type: [Object] })
    @IsOptional()
    @IsArray()
    specs?: any[];

    @ApiProperty({ required: false, type: [Object] })
    @IsOptional()
    @IsArray()
    units?: any[];

    @ApiProperty({ required: false })
    @IsOptional()
    metadata?: any;

    @ApiProperty({
        type: [CategoryContentDto],
        description: 'محتوای چندزبانه دسته‌بندی'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CategoryContentDto)
    contents: CategoryContentDto[];
}