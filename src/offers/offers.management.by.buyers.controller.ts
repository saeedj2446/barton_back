// src/offers/controllers/offers-management.controller.ts
import {
    Controller,
    Get,
    Put,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe, Body,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';

import { OfferStatus, Language } from '@prisma/client';
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {OffersService} from "./offers.service";
import {CurrentUser} from "../common/decorators/current-user.decorator";
import {LanguageHeader} from "../common/decorators/language.decorator";
import {CounterOfferDto} from "./dto/counter-offer.dto";

@ApiTags('Offers - Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('offers/management')
export class OffersManagementByBuyersController {
    constructor(private readonly offersService: OffersService) {}

    // ==================== دریافت پیشنهادات یک درخواست خرید ====================
    @Get('buy-ad/:buyAdId')
    @ApiOperation({ summary: 'دریافت پیشنهادات یک درخواست خرید' })
    @ApiParam({ name: 'buyAdId', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: OfferStatus })
    @ApiQuery({ name: 'sort_by', required: false, type: String })
    @ApiResponse({ status: 200, description: 'لیست پیشنهادات درخواست خرید' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async findByBuyAd(
        @Param('buyAdId', ParseUUIDPipe) buyAdId: string,
        @Query() query: any,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.findByBuyAd(buyAdId, { ...query, language }, user.id);
    }

    // ==================== پذیرش پیشنهاد ====================
    @Put(':id/accept')
    @ApiOperation({ summary: 'پذیرش پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'پیشنهاد با موفقیت پذیرفته شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    @ApiResponse({ status: 409, description: 'پیشنهاد قابل پذیرش نیست' })
    async acceptOffer(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.acceptOffer(id, user.id, language);
    }

    // ==================== رد پیشنهاد ====================
    @Put(':id/reject')
    @ApiOperation({ summary: 'رد پیشنهاد' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiQuery({ name: 'reason', required: false, type: String })
    @ApiResponse({ status: 200, description: 'پیشنهاد با موفقیت رد شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    @ApiResponse({ status: 409, description: 'پیشنهاد قابل رد نیست' })
    async rejectOffer(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
        @Query('reason') reason?: string,
    ) {
        return this.offersService.rejectOffer(id, user.id, reason);
    }

    // ==================== پیشنهاد متقابل ====================
    @Put(':id/counter')
    @ApiOperation({ summary: 'ارسال پیشنهاد متقابل' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'پیشنهاد متقابل با موفقیت ارسال شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    @ApiResponse({ status: 409, description: 'ارسال پیشنهاد متقابل مجاز نیست' })
    async counterOffer(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() counterOfferDto: CounterOfferDto,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language,
    ) {
        return this.offersService.counterOffer(id, counterOfferDto, user.id, language);
    }

    // ==================== علامت‌گذاری به عنوان دیده شده ====================
    @Put(':id/mark-seen')
    @ApiOperation({ summary: 'علامت‌گذاری پیشنهاد به عنوان دیده شده' })
    @ApiParam({ name: 'id', description: 'شناسه پیشنهاد' })
    @ApiResponse({ status: 200, description: 'پیشنهاد به عنوان دیده شده علامت‌گذاری شد' })
    @ApiResponse({ status: 404, description: 'پیشنهاد یافت نشد' })
    async markAsSeen(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
    ) {
        return this.offersService.markAsSeen(id, user.id);
    }
}