import { ApiProperty } from '@nestjs/swagger';
import {SystemRole, UserSex} from '@prisma/client';

export class UserResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    mobile: string;

    @ApiProperty()
    first_name: string;

    @ApiProperty()
    last_name: string;

    @ApiProperty({ enum: SystemRole })
    system_role: SystemRole;

    @ApiProperty()
    is_verified: boolean;

    @ApiProperty()
    is_blocked: boolean;

    @ApiProperty()
    created_at: Date;

    @ApiProperty()
    accountsCount?: number;

    @ApiProperty()
    ordersCount?: number;

    @ApiProperty({ enum: UserSex })
    sex: SystemRole;
}