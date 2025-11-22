import { PartialType } from '@nestjs/swagger';
import { CreateIndustryDto } from './create-industry.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIndustryDto extends PartialType(CreateIndustryDto) {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    introduction?: string;
}