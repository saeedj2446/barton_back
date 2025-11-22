// src/offers/controllers/offers-admin.controller.ts
import {
    Controller,
    Get,
    Delete,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus, Put,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';

import { OfferStatus, OfferType, Language, SystemRole } from '@prisma/client';
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {RolesGuard} from "../common/guards/roles.guard";
import {Roles} from "../common/decorators/roles.decorator";
import {OffersService} from "./offers.service";
import {LanguageHeader} from "../common/decorators/language.decorator";
import {CurrentUser} from "../common/decorators/current-user.decorator";

@ApiTags('Admin - Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
@Controller('admin/offers')
export class OffersAdminController {
    constructor(private readonly offersService: OffersService) {}

    // ==================== دریافت تمام پیشنهادات (مدیریتی) ====================
    @Get()
    @ApiOperation({ summary: 'دریافت تمام پیشنهادات (مدیریتی)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: OfferStatus })
    @ApiQuery({ name: 'type', required: false, enum: OfferType })
    @ApiQuery({ name: 'user_id', required: false, type: String })
    @ApiQuery({ name: 'buy_ad_id', required: false, type: String })
    @ApiResponse({ status: 200, description: 'لیست پیشنهادات مدیریتی' })
    async findAll(
        @Query() query: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.findAllAdmin({ ...query, language });
    }

    // ==================== دریافت جزئیات کامل پیشنهاد ====================
    @Get(':id')
    @ApiOperation({ summary: 'دریافت جزئیات کامل پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'جزئیات کامل پیشنهاد' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.findOneAdmin(id, language);
    }

    // ==================== حذف اجباری پیشنهاد ====================
    @Delete(':id/force')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'حذف اجباری پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'پیشنهاد با موفقیت حذف شد' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    async forceRemove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
    ) {
        return this.offersService.forceRemove(id, user.id);
    }

    // ==================== آمار و گزارشات مدیریتی ====================
    @Get('stats/admin')
    @ApiOperation({ summary: 'دریافت آمار و گزارشات مدیریتی' })
    @ApiQuery({ name: 'timeframe', required: false, type: String })
    @ApiResponse({ status: 200, description: 'آمار مدیریتی' })
    async getAdminStats(
        @Query('timeframe') timeframe: string = '30d',
    ) {
        return this.offersService.getAdminStats(timeframe);
    }

    // ==================== بررسی انقضای خودکار پیشنهادات ====================
    @Put('cron/expire-check')
    @ApiOperation({ summary: 'بررسی و انقضای خودکار پیشنهادات' })
    @ApiResponse({ status: 200, description: 'بررسی انقضا انجام شد' })
    async checkAndExpireOffers() {
        return this.offersService.checkAndExpireOffers();
    }
}