// src/buy-ad/controllers/buy-ad-public.controller.ts
import {
    Controller,
    Get,
    Param,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { BuyAdStatus, BuyAdType, Language } from '@prisma/client';
import {BuyAdService} from "./buy-ad.service";
import {BuyAdQueryDto} from "./dto/buy-ad-query.dto";


@ApiTags('Buy Ads - Public')
@Controller('buy-ads')
export class BuyAdPublicController {
    constructor(private readonly buyAdService: BuyAdService) {}

    // ==================== جستجوی عمومی درخواست‌های خرید ====================
    @Get('search')
    @ApiOperation({ summary: 'جستجوی عمومی درخواست‌های خرید' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'type', required: false, enum: BuyAdType })
    @ApiQuery({ name: 'status', required: false, enum: BuyAdStatus })
    @ApiQuery({ name: 'category_id', required: false, type: Number })
    @ApiQuery({ name: 'location_level_1_id', required: false, type: String })
    @ApiQuery({ name: 'location_level_2_id', required: false, type: String })
    @ApiQuery({ name: 'location_level_3_id', required: false, type: String })
    @ApiQuery({ name: 'location_level_4_id', required: false, type: String })
    @ApiQuery({ name: 'min_amount', required: false, type: Number })
    @ApiQuery({ name: 'max_amount', required: false, type: Number })
    @ApiQuery({ name: 'unit', required: false, type: String })
    @ApiQuery({ name: 'sort_by', required: false, type: String })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'نتایج جستجوی عمومی' })
    async searchBuyAds(@Query() query: BuyAdQueryDto) {
        return this.buyAdService.searchBuyAds(query);
    }

    // ==================== دریافت جزئیات عمومی یک درخواست خرید ====================
    @Get(':id')
    @ApiOperation({ summary: 'دریافت جزئیات عمومی یک درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'جزئیات عمومی درخواست خرید' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.findOne(id, language);
    }

    // ==================== دریافت پرطرفدارترین درخواست‌های خرید ====================
    @Get('featured/popular')
    @ApiOperation({ summary: 'دریافت پرطرفدارترین درخواست‌های خرید' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'لیست پرطرفدارترین درخواست‌ها' })
    async getPopularBuyAds(
        @Query('limit') limit: number = 10,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.searchBuyAds({
            limit,
            language,
            sort_by: 'most_offers',
            status: BuyAdStatus.APPROVED,
        });
    }

    // ==================== دریافت جدیدترین درخواست‌های خرید ====================
    @Get('featured/recent')
    @ApiOperation({ summary: 'دریافت جدیدترین درخواست‌های خرید' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'لیست جدیدترین درخواست‌ها' })
    async getRecentBuyAds(
        @Query('limit') limit: number = 10,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.searchBuyAds({
            limit,
            language,
            sort_by: 'newest',
            status: BuyAdStatus.APPROVED,
        });
    }

    // ==================== دریافت درخواست‌های خرید فوری ====================
    @Get('featured/urgent')
    @ApiOperation({ summary: 'دریافت درخواست‌های خرید فوری' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'لیست درخواست‌های فوری' })
    async getUrgentBuyAds(
        @Query('limit') limit: number = 10,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.searchBuyAds({
            limit,
            language,
            sort_by: 'urgent',
            status: BuyAdStatus.APPROVED,
        });
    }
}