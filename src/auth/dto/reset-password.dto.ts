// src/auth/dto/reset-password.dto.ts
import { IsNotEmpty, IsString, MinLength, IsMobilePhone } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({ example: '989196421264' })
    @IsNotEmpty()
    @IsString()
    @IsMobilePhone('fa-IR')
    mobile: string;

    @ApiProperty({ example: '12345' })
    @IsNotEmpty()
    @IsString()
    code: string;

    @ApiProperty({
        example: '123456',
        description: 'رمز عبور جدید',
        minLength: 6
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    newPassword: string;
}