import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';

export class IndustryRelationQueryDto {
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
    supplier_industry_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    customer_industry_id?: string;

    @ApiProperty({
        required: false,
        enum: ['DIRECT_SUPPLY', 'COMPLEMENTARY', 'POTENTIAL', 'COMPETITIVE']
    })
    @IsString()
    @IsOptional()
    relation_type?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    min_strength?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    max_strength?: number;

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