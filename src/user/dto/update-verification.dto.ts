// src/user/dto/update-verification.dto.ts
import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVerificationDto {
    @ApiProperty()
    @IsBoolean()
    is_verified: boolean;
}