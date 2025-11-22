// src/categories/dto/category-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryQueryDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parent_id?: string;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    include_children?: boolean = false;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ required: false, default: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 50;
}