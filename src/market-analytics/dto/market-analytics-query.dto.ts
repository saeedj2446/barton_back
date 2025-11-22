// src/market-analytics/dto/market-analytics-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AnalysisPeriod } from '@prisma/client';
import { IsOptional, IsEnum, IsString } from 'class-validator';

export class MarketAnalyticsQueryDto {
    @ApiPropertyOptional({ description: 'شناسه صنف' })
    @IsOptional()
    @IsString()
    industry_id?: string;

    @ApiPropertyOptional({
        enum: AnalysisPeriod,
        description: 'بازه زمانی تحلیل',
        default: 'DAILY'
    })
    @IsOptional()
    @IsEnum(AnalysisPeriod)
    period_type?: AnalysisPeriod;

    @ApiPropertyOptional({ description: 'شناسه محصول برای تحلیل قیمت' })
    @IsOptional()
    @IsString()
    product_id?: string;
}