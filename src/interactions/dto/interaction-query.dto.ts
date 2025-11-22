// src/interactions/dto/interaction-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { InteractionType } from '@prisma/client';

export class InteractionQueryDto {
    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    limit?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    user_id?: string;

    @ApiProperty({ enum: InteractionType, required: false })
    @IsEnum(InteractionType)
    @IsOptional()
    type?: InteractionType;
}