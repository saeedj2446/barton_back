import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { AccountRole } from '@prisma/client';

export class AddUserToAccountDto {
    @ApiProperty({
        description: 'شناسه کاربری که می‌خواهید اضافه کنید',
        example: '507f1f77bcf86cd799439011'
    })
    @IsString()
    @IsNotEmpty()
    target_user_id: string;

    @ApiProperty({
        enum: AccountRole,
        example: AccountRole.MANAGER,
        description: 'نقش کاربر در کسب‌وکار'
    })
    @IsEnum(AccountRole)
    @IsNotEmpty()
    role: AccountRole;
}