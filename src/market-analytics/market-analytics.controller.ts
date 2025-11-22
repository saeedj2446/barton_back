import { Controller, Get, Query, Post } from '@nestjs/common';
import { MarketAnalyticsService } from './market-analytics.service';
import { MarketAnalyticsQueryDto } from './dto/market-analytics-query.dto';

@Controller('market-analytics')
export class MarketAnalyticsController {
    constructor(private readonly marketAnalyticsService: MarketAnalyticsService) {}

    @Get('industry')
    async getIndustryAnalytics(@Query() query: MarketAnalyticsQueryDto) {
        return this.marketAnalyticsService.getIndustryAnalysis(
            query.industry_id,
            query.period_type
        );
    }

    @Get('product-price-analysis')
    async getProductPriceAnalysis(@Query('product_id') productId: string) {
        return this.marketAnalyticsService.getProductPriceAnalysis(productId);
    }

    @Get('market-overview')
    async getMarketOverview(@Query() query: MarketAnalyticsQueryDto) {
        // یک نمای کلی از بازار برگردان
        const industryAnalysis = await this.marketAnalyticsService.getIndustryAnalysis(
            query.industry_id,
            query.period_type
        );

        return {
            market_activity: industryAnalysis?.market_activity_index || 0,
            price_trend: industryAnalysis?.price_trend || 0,
            demand_supply_ratio: industryAnalysis?.demand_supply_ratio || 1,
            total_listings: industryAnalysis?.total_listings || 0,
            period: industryAnalysis?.period_start
        };
    }

    @Post('trigger-daily-analysis')
    async triggerDailyAnalysis() {
        await this.marketAnalyticsService.runDailyMarketAnalysis();
        return { message: 'Daily market analysis started successfully' };
    }

    @Get('trending-products')
    async getTrendingProducts(@Query() query: MarketAnalyticsQueryDto) {
        const analysis = await this.marketAnalyticsService.getIndustryAnalysis(
            query.industry_id,
            query.period_type
        );

        return {
            trending_up: analysis?.trending_up_products || [],
            trending_down: analysis?.trending_down_products || []
        };
    }

    @Get('pricing-recommendations')
    async getPricingRecommendations(@Query() query: MarketAnalyticsQueryDto) {
        const analysis = await this.marketAnalyticsService.getIndustryAnalysis(
            query.industry_id,
            query.period_type
        );

        return analysis?.pricing_recommendations || {
            for_sellers: [],
            for_buyers: [],
            market_insights: [],
            risk_alerts: []
        };
    }
}