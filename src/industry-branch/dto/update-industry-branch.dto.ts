import { PartialType } from '@nestjs/swagger';
import { CreateIndustryBranchDto } from './create-industry-branch.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIndustryBranchDto extends PartialType(CreateIndustryBranchDto) {
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
    department?: string;
}