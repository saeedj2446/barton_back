// src/file/dto/create-file.dto.ts
import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { FileUsage } from '@prisma/client';

export class CreateFileDto {
    @IsString()
    file_path: string;

    @IsString()
    @IsOptional()
    thumbnail_path?: string;

    @IsEnum(FileUsage)
    file_usage: FileUsage;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    product_id?: string;

    @IsString()
    @IsOptional()
    account_id?: string;

    @IsString()
    @IsOptional()
    user_id?: string;
}