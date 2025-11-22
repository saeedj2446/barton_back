// src/locations/dto/location-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationType } from '@prisma/client';

export class LocationQueryDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({ required: false, enum: LocationType })
    @IsOptional()
    @IsEnum(LocationType)
    type?: LocationType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parent_id?: string;

    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ required: false, default: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 50;
}