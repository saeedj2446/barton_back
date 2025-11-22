import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IndustryBusinessType, Language } from '@prisma/client';

export class IndustryQueryDto {
    @ApiProperty({ required: false, default: 1 })
    @IsNumber()
    @IsOptional()
    page?: number = 1;

    @ApiProperty({ required: false, default: 10 })
    @IsNumber()
    @IsOptional()
    limit?: number = 10;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    branch?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    sub_branch?: string;

    @ApiProperty({ enum: IndustryBusinessType, required: false })
    @IsString()
    @IsOptional()
    business_type?: IndustryBusinessType;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    level?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    industry_branch_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    parentId?: string;

    @ApiProperty({ required: false, default: false })
    @IsBoolean()
    @IsOptional()
    with_relations?: boolean = false;

    @ApiProperty({ required: false, default: false })
    @IsBoolean()
    @IsOptional()
    with_accounts?: boolean = false;

    @ApiProperty({ required: false, default: 'created_at' })
    @IsString()
    @IsOptional()
    sortBy?: string = 'created_at';

    @ApiProperty({ required: false, default: 'desc' })
    @IsString()
    @IsOptional()
    sortOrder?: 'asc' | 'desc' = 'desc';

    @ApiProperty({ enum: Language, required: false })
    @IsOptional()
    @IsEnum(Language)
    language?: Language;
}