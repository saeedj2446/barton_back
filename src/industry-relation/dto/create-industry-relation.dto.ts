import { IsString, IsNumber, IsNotEmpty, Min, Max, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';

export class CreateIndustryRelationDto {
    @ApiProperty({ example: '65a1b2c3d4e5f6a1b2c3d4e5' })
    @IsString()
    @IsNotEmpty()
    supplier_industry_id: string;

    @ApiProperty({ example: '65a1b2c3d4e5f6a1b2c3d4e5' })
    @IsString()
    @IsNotEmpty()
    customer_industry_id: string;

    @ApiProperty({
        example: 'DIRECT_SUPPLY',
        enum: ['DIRECT_SUPPLY', 'COMPLEMENTARY', 'POTENTIAL', 'COMPETITIVE']
    })
    @IsString()
    @IsNotEmpty()
    relation_type: string;

    @ApiProperty({ example: 0.8, minimum: 0, maximum: 1 })
    @IsNumber()
    @Min(0)
    @Max(1)
    strength: number;

    @ApiProperty({ enum: Language, required: false })
    @IsOptional()
    @IsEnum(Language)
    language?: Language;
}