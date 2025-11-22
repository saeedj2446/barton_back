import {ApiProperty} from "@nestjs/swagger";
import {IsNumber, IsOptional, IsString} from "class-validator";
import {ActivityStatsQueryDto} from "./activity-stats.dto";

export class ActivityAnalyticsQueryDto extends ActivityStatsQueryDto {
    @ApiProperty({ required: false, default: 10 })
    @IsNumber()
    @IsOptional()
    top_limit?: number;

    @ApiProperty({ required: false, default: 'count' })
    @IsString()
    @IsOptional()
    metric?: 'count' | 'duration' | 'value';
}