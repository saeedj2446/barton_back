// src/user/dto/update-role.dto.ts
import { IsEnum } from 'class-validator';
import { SystemRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
    @ApiProperty({ enum: SystemRole })
    @IsEnum(SystemRole)
    system_role: SystemRole;
}