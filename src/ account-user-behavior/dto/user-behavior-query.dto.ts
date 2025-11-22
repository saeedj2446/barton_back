import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, IsString, IsDate } from 'class-validator';
import { UserActivityType } from '@prisma/client';

export class UserBehaviorQueryDto {
    @ApiProperty({ required: false, default: 1 })
    @IsNumber()
    @IsOptional()
    page?: number;

    @ApiProperty({ required: false, default: 20 })
    @IsNumber()
    @IsOptional()
    limit?: number;

    @ApiProperty({ enum: UserActivityType, required: false })
    @IsEnum(UserActivityType)
    @IsOptional()
    activity_type?: UserActivityType;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_user_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    target_type?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    product_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    start_date?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    end_date?: string;
}