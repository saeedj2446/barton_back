// src/interactions/dto/create-interaction.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InteractionType } from '@prisma/client';

export class CreateInteractionDto {
    @ApiProperty({ enum: InteractionType })
    @IsEnum(InteractionType)
    type: InteractionType;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_id?: string;
}

