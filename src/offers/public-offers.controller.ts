// src/offers/controllers/offers-public.controller.ts
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
import { Language } from '@prisma/client';
import {OffersService} from "./offers.service";
import {LanguageHeader} from "../common/decorators/language.decorator";

@ApiTags('Offers - Public')
@Controller('public/offers')
export class OffersPublicController {
    constructor(private readonly offersService: OffersService) {}

    // ==================== دریافت پیشنهادات برتر (عمومی) ====================
    @Get('featured')
    @ApiOperation({ summary: 'دریافت پیشنهادات برتر برای نمایش عمومی' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'لیست پیشنهادات برتر عمومی' })
    async getFeaturedOffers(
        @Query('limit') limit: number = 6,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.getFeaturedOffers(limit, language);
    }

    // ==================== دریافت آمار کلی پیشنهادات (عمومی) ====================
    @Get('stats/overview')
    @ApiOperation({ summary: 'دریافت آمار کلی پیشنهادات برای نمایش عمومی' })
    @ApiResponse({ status: 200, description: 'آمار کلی پیشنهادات' })
    async getPublicStats(@LanguageHeader() language: Language) {
        return this.offersService.getPublicStats(language);
    }

    // ==================== دریافت جزئیات محدود یک پیشنهاد (عمومی) ====================
    @Get(':id/preview')
    @ApiOperation({ summary: 'دریافت پیش‌نمایش محدود از یک پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'پیش‌نمایش پیشنهاد' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    async getOfferPreview(
        @Param('id', ParseUUIDPipe) id: string,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.getOfferPreview(id, language);
    }

    // ==================== دریافت موفق‌ترین پیشنهادات ====================
    @Get('success-stories')
    @ApiOperation({ summary: 'دریافت داستان‌های موفق پیشنهادات' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'لیست داستان‌های موفق' })
    async getSuccessStories(
        @Query('limit') limit: number = 4,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.getSuccessStories(limit, language);
    }
}