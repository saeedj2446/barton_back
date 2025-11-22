// src/file/dto/update-file.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateFileDto } from './create-file.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFileDto extends PartialType(CreateFileDto) {
    @ApiProperty({ required: false, example: 'توضیحات جدید برای فایل' })
    @IsString()
    @IsOptional()
    description?: string;
}