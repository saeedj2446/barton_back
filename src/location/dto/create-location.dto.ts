// src/locations/dto/create-location.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationType, Language } from '@prisma/client';

export class LocationContentDto {
    @ApiProperty({ enum: Language })
    @IsEnum(Language)
    language: Language;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    full_name?: string;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    auto_translated?: boolean = false;
}

export class CreateLocationDto {
    @ApiProperty({ enum: LocationType })
    @IsEnum(LocationType)
    type: LocationType;

    @ApiProperty()
    @IsString()
    code: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parent_id?: string;

    @ApiProperty({
        required: true,
        type: [LocationContentDto],
        description: 'محتوای چندزبانه Location'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LocationContentDto)
    contents: LocationContentDto[];
}