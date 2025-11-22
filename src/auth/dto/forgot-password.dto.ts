import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
    @ApiProperty({ example: '989196421264' })
    @IsNotEmpty()
    @IsString()
    mobile: string;
}