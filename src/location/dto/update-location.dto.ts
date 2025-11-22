// src/locations/dto/update-location.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateLocationDto, LocationContentDto } from './create-location.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLocationDto extends PartialType(CreateLocationDto) {
    @ApiProperty({
        required: false,
        type: [LocationContentDto],
        description: 'محتوای چندزبانه برای آپدیت'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LocationContentDto)
    contents?: LocationContentDto[];
}