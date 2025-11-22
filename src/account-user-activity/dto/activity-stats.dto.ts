import { ApiProperty } from '@nestjs/swagger';
import {IsOptional, IsString, IsNumber, IsDate, IsArray} from 'class-validator';

export class ActivityStatsQueryDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_user_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    user_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    start_date?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    end_date?: string;

    @ApiProperty({ required: false, default: 7 })
    @IsNumber()
    @IsOptional()
    days?: number;

    // ✅ اضافه کردن فیلد برای آرایه account_user_ids
    @ApiProperty({ required: false, type: [String] })
    @IsArray()
    @IsOptional()
    account_user_ids?: string[];
}

