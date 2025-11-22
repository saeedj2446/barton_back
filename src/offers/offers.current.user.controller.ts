// src/offers/controllers/offers-current-user.controller.ts
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';

import { OfferStatus, OfferType, OfferPriority, Language } from '@prisma/client';
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {OffersService} from "./offers.service";
import {CreateOfferDto} from "./dto/create-offer.dto";
import {CurrentUser} from "../common/decorators/current-user.decorator";
import {LanguageHeader} from "../common/decorators/language.decorator";
import {OfferQueryDto} from "./dto/offer-query.dto";
import {UpdateOfferDto} from "./dto/update-offer.dto";

@ApiTags('Offers - Current User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('offers/my')
export class OffersCurrentUserController {
    constructor(private readonly offersService: OffersService) {}

    // ==================== ایجاد پیشنهاد جدید ====================
    @Post()
    @ApiOperation({ summary: 'ایجاد پیشنهاد جدید' })
    @ApiResponse({ status: 201, description: 'پیشنهاد با موفقیت ایجاد شد' })
    @ApiResponse({ status: 400, description: 'داده‌های ورودی نامعتبر' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    @ApiResponse({ status: 409, description: 'پیشنهاد فعال از قبل وجود دارد' })
    async create(
        @Body() createOfferDto: CreateOfferDto,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.create(createOfferDto, user.id, language);
    }

    // ==================== دریافت تمام پیشنهادات کاربر ====================
    @Get()
    @ApiOperation({ summary: 'دریافت تمام پیشنهادات کاربر' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: OfferStatus })
    @ApiQuery({ name: 'type', required: false, enum: OfferType })
    @ApiQuery({ name: 'buy_ad_id', required: false, type: String })
    @ApiQuery({ name: 'account_id', required: false, type: String })
    @ApiQuery({ name: 'sort_by', required: false, type: String })
    @ApiResponse({ status: 200, description: 'لیست پیشنهادات کاربر' })
    async findAll(
        @Query() query: OfferQueryDto,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.findAllByUser(
            { ...query, language },
            user.id
        );
    }

    // ==================== دریافت جزئیات یک پیشنهاد ====================
    @Get(':id')
    @ApiOperation({ summary: 'دریافت جزئیات یک پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'جزئیات پیشنهاد' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.findOne(id, user.id, language);
    }

    // ==================== بروزرسانی پیشنهاد ====================
    @Put(':id')
    @ApiOperation({ summary: 'بروزرسانی پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'پیشنهاد با موفقیت بروزرسانی شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    @ApiResponse({ status: 409, description: 'پیشنهاد قابل ویرایش نیست' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateOfferDto: UpdateOfferDto,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.update(id, updateOfferDto, user.id, language);
    }

    // ==================== حذف پیشنهاد ====================
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'حذف پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'پیشنهاد با موفقیت حذف شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    @ApiResponse({ status: 409, description: 'پیشنهاد قابل حذف نیست' })
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
    ) {
        return this.offersService.remove(id, user.id);
    }

    // ==================== آمار و گزارشات کاربر ====================
    @Get('stats/overview')
    @ApiOperation({ summary: 'دریافت آمار کلی پیشنهادات کاربر' })
    @ApiQuery({ name: 'timeframe', required: false, type: String })
    @ApiResponse({ status: 200, description: 'آمار کلی کاربر' })
    async getStats(
        @CurrentUser() user: any,
        @Query('timeframe') timeframe: string = '30d',
    ) {
        return this.offersService.getOfferStats(user.id, timeframe);
    }

    // ==================== دریافت تاریخچه مذاکرات ====================
    @Get('negotiations/history')
    @ApiOperation({ summary: 'دریافت تاریخچه مذاکرات کاربر' })
    @ApiQuery({ name: 'buy_ad_id', required: false, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'تاریخچه مذاکرات' })
    async getNegotiationHistory(
        @CurrentUser() user: any,
        @Query('buy_ad_id') buyAdId?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        return this.offersService.getNegotiationHistory(user.id, buyAdId, page, limit);
    }
}