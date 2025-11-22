// src/account/dto/add-user-to-account.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { AccountRole } from '@prisma/client';

export class AddUserToAccountDto {
    @ApiProperty({ example: 'user_id_here', description: 'شناسه کاربری که می‌خواهید اضافه کنید' })
    @IsString()
    @IsNotEmpty()
    targetUserId: string;

    @ApiProperty({
        enum: AccountRole,
        example: AccountRole.MANAGER,
        description: 'نقش کاربر در کسب‌وکار'
    })
    @IsEnum(AccountRole)
    @IsNotEmpty()
    role: AccountRole;
}