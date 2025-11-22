// src/auth/dto/logout.dto.ts
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
    @ApiPropertyOptional({ description: 'دلیل لاگ‌اوت (اختیاری)' })
    @IsOptional()
    @IsString()
    reason?: string;
}