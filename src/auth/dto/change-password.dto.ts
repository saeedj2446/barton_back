// src/auth/dto/change-password.dto.ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({
        example: '123456',
        description: 'رمز عبور فعلی'
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    currentPassword: string;

    @ApiProperty({
        example: '123456',
        description: 'رمز عبور جدید'
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    newPassword: string;
}