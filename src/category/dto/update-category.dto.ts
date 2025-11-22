// src/categories/dto/update-category.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, ValidateNested, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryContentDto } from './create-category.dto';

export class UpdateCategoryDto {
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
        required: false,
        type: [CategoryContentDto],
        description: 'محتوای چندزبانه برای آپدیت'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CategoryContentDto)
    contents?: CategoryContentDto[];
}