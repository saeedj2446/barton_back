import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { AccountRole } from '@prisma/client';

export class UpdateUserRoleDto {
    @ApiProperty({
        enum: AccountRole,
        example: AccountRole.MANAGER,
        description: 'نقش جدید کاربر در کسب‌وکار'
    })
    @IsEnum(AccountRole)
    @IsNotEmpty()
    role: AccountRole;
}