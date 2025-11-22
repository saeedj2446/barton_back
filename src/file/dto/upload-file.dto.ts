// src/file/dto/upload-file.dto.ts
import { IsEnum, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { FileUsage } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
    @ApiProperty({ enum: FileUsage, example: FileUsage.PROFILE_PHOTO })
    @IsEnum(FileUsage)
    file_usage: FileUsage;

    @ApiProperty({ required: false, example: 'توضیحات فایل' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ required: false, example: 800 })
    @IsNumber()
    @IsOptional()
    @Min(50)
    maxWidth?: number;

    @ApiProperty({ required: false, example: 600 })
    @IsNumber()
    @IsOptional()
    @Min(50)
    maxHeight?: number;

    @ApiProperty({ required: false, example: 500 })
    @IsNumber()
    @IsOptional()
    @Min(50)
    @Max(2000)
    maxSizeKB?: number;

    @ApiProperty({ required: false, example: 'product_123' })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ required: false, example: 'account_123' })
    @IsString()
    @IsOptional()
    account_id?: string;


}