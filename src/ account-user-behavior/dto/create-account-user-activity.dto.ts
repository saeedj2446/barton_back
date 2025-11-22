import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumber, IsObject, IsDate } from 'class-validator';
import { UserActivityType } from '@prisma/client';

export class CreateAccountUserActivityDto {
    @ApiProperty({ description: 'شناسه کاربر-اکانت' })
    @IsString()
    account_user_id: string;

    @ApiProperty({ enum: UserActivityType, description: 'نوع فعالیت' })
    @IsEnum(UserActivityType)
    activity_type: UserActivityType;

    @ApiProperty({ description: 'نوع هدف فعالیت', required: false })
    @IsString()
    @IsOptional()
    target_type?: string;

    @ApiProperty({ description: 'شناسه هدف فعالیت', required: false })
    @IsString()
    @IsOptional()
    target_id?: string;

    @ApiProperty({ description: 'متادیتای فعالیت', required: false })
    @IsObject()
    @IsOptional()
    metadata?: any;

    @ApiProperty({ description: 'وزن فعالیت', required: false, default: 1 })
    @IsNumber()
    @IsOptional()
    weight?: number;

    @ApiProperty({ description: 'شناسه محصول', required: false })
    @IsString()
    @IsOptional()
    product_id?: string;
}