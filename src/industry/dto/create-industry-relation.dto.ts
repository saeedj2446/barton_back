// industry/dto/create-industry-relation.dto.ts
import { IsString, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIndustryRelationDto {
    @ApiProperty({ example: '65a1b2c3d4e5f6a1b2c3d4e5' })
    @IsString()
    @IsNotEmpty()
    supplier_industry_id: string;

    @ApiProperty({ example: '65a1b2c3d4e5f6a1b2c3d4e5' })
    @IsString()
    @IsNotEmpty()
    customer_industry_id: string;

    @ApiProperty({ example: 'DIRECT_SUPPLY' })
    @IsString()
    @IsNotEmpty()
    relation_type: string;

    @ApiProperty({ example: 0.8, minimum: 0, maximum: 1 })
    @IsNumber()
    @Min(0)
    @Max(1)
    strength: number;
}