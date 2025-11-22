// src/buy-ad/controllers/buy-ad-admin.controller.ts
import {
    Controller,
    Get,
    Put,
    Delete,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';

import { BuyAdStatus, BuyAdType, Language, SystemRole } from '@prisma/client';
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {RolesGuard} from "../common/guards/roles.guard";
import {Roles} from "../common/decorators/roles.decorator";
import {BuyAdService} from "./buy-ad.service";
import {CurrentUser} from "../common/decorators/current-user.decorator";
import {LanguageHeader} from "../common/decorators/language.decorator";

@ApiTags('Admin - Buy Ads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
@Controller('admin/buy-ads')
export class BuyAdAdminController {
    constructor(private readonly buyAdService: BuyAdService) {}

    // ==================== دریافت تمام درخواست‌های خرید (مدیریتی) ====================
    @Get()
    @ApiOperation({ summary: 'دریافت تمام درخواست‌های خرید (مدیریتی)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, enum: BuyAdStatus })
    @ApiQuery({ name: 'type', required: false, enum: BuyAdType })
    @ApiQuery({ name: 'user_id', required: false, type: String })
    @ApiQuery({ name: 'account_id', required: false, type: String })
    @ApiResponse({ status: 200, description: 'لیست درخواست‌های خرید مدیریتی' })
    async findAll(
        @CurrentUser() user: any,
        @Query() query: any,
        @LanguageHeader() language: Language
    ) {
        return this.buyAdService.searchBuyAds({
            ...query,
            language: query.language || language,
        });
    }

    // ==================== دریافت جزئیات کامل درخواست خرید ====================
    @Get(':id')
    @ApiOperation({ summary: 'دریافت جزئیات کامل درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiResponse({ status: 200, description: 'جزئیات کامل درخواست خرید' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @LanguageHeader() language: Language
    ) {
        return this.buyAdService.findOne(id, language);
    }

    // ==================== حذف اجباری درخواست خرید ====================
    @Delete(':id/force')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'حذف اجباری درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiResponse({ status: 200, description: 'درخواست خرید با موفقیت حذف شد' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async forceRemove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
    ) {
        // این متد نیاز به پیاده‌سازی در سرویس دارد
        return this.buyAdService.forceRemove(id, user.id);
    }

    // ==================== تغییر وضعیت توسط ادمین ====================
    @Put(':id/status')
    @ApiOperation({ summary: 'تغییر وضعیت درخواست خرید توسط ادمین' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'status', required: true, enum: BuyAdStatus })
    @ApiResponse({ status: 200, description: 'وضعیت با موفقیت تغییر کرد' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('status') status: BuyAdStatus,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language
    ) {
        return this.buyAdService.updateStatus(id, status, user.id, language);
    }

    // ==================== آمار و گزارشات مدیریتی ====================
    @Get('stats/overview')
    @ApiOperation({ summary: 'دریافت آمار و گزارشات مدیریتی' })
    @ApiQuery({ name: 'timeframe', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, enum: BuyAdStatus })
    @ApiQuery({ name: 'type', required: false, enum: BuyAdType })
    @ApiResponse({ status: 200, description: 'آمار مدیریتی' })
    async getAdminStats(
        @Query('timeframe') timeframe: string = '30d',
        @Query('status') status?: BuyAdStatus,
        @Query('type') type?: BuyAdType,
    ) {
        // این متد نیاز به پیاده‌سازی در سرویس دارد
        return this.buyAdService.getAdminStats(timeframe, status, type);
    }

    // ==================== بررسی انقضای خودکار ====================
    @Put('cron/expire-check')
    @ApiOperation({ summary: 'بررسی و انقضای خودکار درخواست‌های خرید' })
    @ApiResponse({ status: 200, description: 'بررسی انقضا انجام شد' })
    async checkAndExpireBuyAds() {
        return this.buyAdService.checkAndExpireBuyAds();
    }

    // ==================== دریافت درخواست‌های خرید مشکل‌دار ====================
    @Get('reports/problematic')
    @ApiOperation({ summary: 'دریافت درخواست‌های خرید مشکل‌دار' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'لیست درخواست‌های مشکل‌دار' })
    async getProblematicBuyAds(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
    ) {
        // این متد نیاز به پیاده‌سازی در سرویس دارد
        return this.buyAdService.getProblematicBuyAds(page, limit);
    }

    // ==================== غیرفعال کردن درخواست خرید ====================
    @Put(':id/deactivate')
    @ApiOperation({ summary: 'غیرفعال کردن درخواست خرید توسط ادمین' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiResponse({ status: 200, description: 'درخواست خرید با موفقیت غیرفعال شد' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async deactivate(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language
    ) {
        return this.buyAdService.deactivate(id, user.id, language);
    }
}