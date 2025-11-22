// src/interactions/public-interactions.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LanguageHeader } from "../common/decorators/language.decorator";
import { Language } from '@prisma/client';

@ApiTags('Public - Interactions')
@Controller('interactions')
export class PublicInteractionsController {
    constructor(private readonly interactionsService: InteractionsService) {}

    @Get('stats/product/:productId')
    @ApiOperation({ summary: 'دریافت آمار تعاملات یک محصول (عمومی)' })
    @ApiResponse({ status: 200, description: 'آمار تعاملات دریافت شد' })
    async getProductStats(
        @Param('productId') productId: string,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getPublicStats(productId, undefined, language);
    }

    @Get('stats/account/:accountId')
    @ApiOperation({ summary: 'دریافت آمار تعاملات یک حساب (عمومی)' })
    @ApiResponse({ status: 200, description: 'آمار تعاملات دریافت شد' })
    async getAccountStats(
        @Param('accountId') accountId: string,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getPublicStats(undefined, accountId, language);
    }

    @Get('popular/products')
    @ApiOperation({ summary: 'محصولات پرطرفدار (عمومی)' })
    @ApiResponse({ status: 200, description: 'محصولات پرطرفدار دریافت شد' })
    async getPopularProducts(
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getPopularProducts(limit, language);
    }

    @Get('trending/products')
    @ApiOperation({ summary: 'محصولات ترند (بر اساس بازدیدهای اخیر)' })
    @ApiResponse({ status: 200, description: 'محصولات ترند دریافت شد' })
    async getTrendingProducts(
        @Query('days') days: number = 7,
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getTrendingProducts(days, limit, language);
    }

    @Get('popular/accounts')
    @ApiOperation({ summary: 'حساب‌های پرطرفدار (عمومی)' })
    @ApiResponse({ status: 200, description: 'حساب‌های پرطرفدار دریافت شد' })
    async getPopularAccounts(
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getPopularAccounts(limit, language);
    }

    @Get('most-liked/products')
    @ApiOperation({ summary: 'پرلایک‌ترین محصولات' })
    async getMostLikedProducts(
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getMostLikedProducts(limit, language);
    }

    @Get('most-saved/products')
    @ApiOperation({ summary: 'پردخیره‌ترین محصولات' })
    async getMostSavedProducts(
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getMostSavedProducts(limit, language);
    }
}