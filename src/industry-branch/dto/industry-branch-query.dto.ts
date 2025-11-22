import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';

export class IndustryBranchQueryDto {
    @ApiProperty({ required: false, default: 1 })
    @IsNumber()
    @IsOptional()
    page?: number = 1;

    @ApiProperty({ required: false, default: 50 })
    @IsNumber()
    @IsOptional()
    limit?: number = 50;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    level?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    department?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    parentId?: string;

    @ApiProperty({ required: false, default: 'name' })
    @IsString()
    @IsOptional()
    sortBy?: string = 'name';

    @ApiProperty({ required: false, default: 'asc' })
    @IsString()
    @IsOptional()
    sortOrder?: 'asc' | 'desc' = 'asc';

    @ApiProperty({ enum: Language, required: false })
    @IsOptional()
    @IsEnum(Language)
    language?: Language;
}