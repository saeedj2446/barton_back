// src/accounts/public-accounts.controller.ts
import {
    Controller,
    Get,
    Param,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { Language } from '@prisma/client';
import { LanguageHeader } from "../common/decorators/language.decorator";

@ApiTags('Public - Accounts')
@Controller('public/accounts')
export class PublicAccountsController {
    constructor(private readonly accountService: AccountService) {}

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات عمومی حساب' })
    @ApiResponse({ status: 200, description: 'اطلاعات حساب دریافت شد' })
    async getPublicAccount(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.getPublicAccount(id, language);
    }

    @Get(':id/interactions-stats')
    @ApiOperation({ summary: 'دریافت آمار تعاملات حساب (عمومی)' })
    async getAccountInteractionsStats(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.getAccountInteractionsStats(id, language);
    }

    @Get('popular')
    @ApiOperation({ summary: 'حساب‌های پرطرفدار (عمومی)' })
    async getPopularAccounts(
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.getPopularAccounts(limit, language);
    }

    @Get()
    @ApiOperation({ summary: 'جستجوی عمومی حساب‌ها' })
    async searchAccounts(
        @Query('q') query: string,
        @Query('industryId') industryId: string,
        @Query('activity_type') activityType: string,
        @Query('location_level_3_id') cityId: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.searchPublicAccounts(
            query,
            industryId,
            activityType,
            cityId,
            page,
            limit,
            language
        );
    }
}