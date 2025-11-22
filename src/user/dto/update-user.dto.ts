// src/user/dto/update-user.dto.ts
import { PartialType } from "@nestjs/swagger";
import { RegistrationDto } from "./create-user.dto";
import { IsNumber, IsOptional, IsDate, IsEnum, IsBoolean, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { SystemRole } from '@prisma/client';

export class UpdateUserDto extends PartialType(RegistrationDto) {
    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    credit_level?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    current_credit?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    bonus_credit?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    total_spent?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    active_package_type?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    package_end?: Date;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    wallet_balance?: number;

    // اضافه کردن فیلدهای سیستمی برای ادمین
    @ApiProperty({ enum: SystemRole, required: false })
    @IsOptional()
    @IsEnum(SystemRole)
    system_role?: SystemRole;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_verified?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_blocked?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_buyer?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_seller?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    sex?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    province?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    activity_type?: string;

    // 🔥 اضافه کردن فیلدهای چندزبانه جدید
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    bio?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    job_title?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    company?: string;


}