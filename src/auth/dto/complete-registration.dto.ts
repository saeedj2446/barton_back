// src/auth/dto/complete-registration.dto.ts
import { IsString, IsOptional, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountActivityType } from '@prisma/client';

export class CompleteRegistrationDto {
    @ApiProperty({ example: 'سعید' })
    @IsString()
    first_name: string;

    @ApiProperty({ example: 'یوسفی' })
    @IsString()
    last_name: string;

    @ApiProperty({
        example: '123456',
        description: 'رمز عبور ',
        minLength: 6
    })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'شرکت نمونه', required: false })
    @IsString()
    @IsOptional()
    business_name?: string;

    @ApiProperty({ enum: AccountActivityType, required: false })
    @IsEnum(AccountActivityType)
    @IsOptional()
    activity_type?: AccountActivityType;
}