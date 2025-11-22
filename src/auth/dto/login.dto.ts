// src/auth/dto/login.dto.ts
import { IsMobilePhone, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '989196421264' })
  @IsMobilePhone('fa-IR')
  mobile: string;

  @ApiProperty({
    example: '123456',
    description: 'رمز عبور ساده'
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}