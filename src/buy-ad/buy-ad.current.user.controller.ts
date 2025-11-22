// src/buy-ad/controllers/buy-ad-current-user.controller.ts
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
import { BuyAdStatus, BuyAdType, Language } from '@prisma/client';
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {BuyAdService} from "./buy-ad.service";
import {CreateBuyAdDto} from "./dto/create-buy-ad.dto";
import {CurrentUser} from "../common/decorators/current-user.decorator";
import {BuyAdQueryDto} from "./dto/buy-ad-query.dto";
import {UpdateBuyAdDto} from "./dto/update-buy-ad.dto";


@ApiTags('Buy Ads - Current User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('buy-ads/my')
export class BuyAdCurrentUserController {
    constructor(private readonly buyAdService: BuyAdService) {}

    // ==================== ایجاد درخواست خرید جدید ====================
    @Post()
    @ApiOperation({ summary: 'ایجاد درخواست خرید جدید' })
    @ApiResponse({ status: 201, description: 'درخواست خرید با موفقیت ایجاد شد' })
    @ApiResponse({ status: 400, description: 'داده‌های ورودی نامعتبر' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'اکانت یافت نشد' })
    async create(
        @Body() createBuyAdDto: CreateBuyAdDto,
        @CurrentUser() user: any,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.create(createBuyAdDto, user.id, language);
    }

    // ==================== دریافت تمام درخواست‌های خرید کاربر ====================
    @Get()
    @ApiOperation({ summary: 'دریافت تمام درخواست‌های خرید کاربر' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: BuyAdStatus })
    @ApiQuery({ name: 'type', required: false, enum: BuyAdType })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'لیست درخواست‌های خرید' })
    async findAll(
        @Query() query: BuyAdQueryDto,
        @CurrentUser() user: any,
    ) {
        return this.buyAdService.findAllByUser(query, user.id);
    }

    // ==================== دریافت جزئیات یک درخواست خرید ====================
    @Get(':id')
    @ApiOperation({ summary: 'دریافت جزئیات یک درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'جزئیات درخواست خرید' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.findOne(id, language, user.id);
    }

    // ==================== بروزرسانی درخواست خرید ====================
    @Put(':id')
    @ApiOperation({ summary: 'بروزرسانی درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'درخواست خرید با موفقیت بروزرسانی شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateBuyAdDto: UpdateBuyAdDto,
        @CurrentUser() user: any,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.update(id, updateBuyAdDto, user.id, language);
    }

    // ==================== حذف درخواست خرید ====================
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'حذف درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiResponse({ status: 200, description: 'درخواست خرید با موفقیت حذف شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    @ApiResponse({ status: 409, description: 'امکان حذف به دلیل وجود پیشنهاد یا مکالمه فعال نیست' })
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
    ) {
        return this.buyAdService.remove(id, user.id);
    }

    // ==================== غیرفعال کردن درخواست خرید ====================
    @Put(':id/deactivate')
    @ApiOperation({ summary: 'غیرفعال کردن درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'درخواست خرید با موفقیت غیرفعال شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async deactivate(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.deactivate(id, user.id, language);
    }

    // ==================== تمدید درخواست خرید ====================
    @Put(':id/extend')
    @ApiOperation({ summary: 'تمدید زمان انقضای درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'تعداد روزهای اضافه' })
    @ApiResponse({ status: 200, description: 'زمان انقضا با موفقیت تمدید شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    @ApiResponse({ status: 409, description: 'فقط درخواست‌های فعال قابل تمدید هستند' })
    async extendExpiry(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any,
        @Query('days') days: number = 7,
    ) {
        return this.buyAdService.extendExpiry(id, user.id, days);
    }

    // ==================== تغییر وضعیت درخواست خرید ====================
    @Put(':id/status')
    @ApiOperation({ summary: 'تغییر وضعیت درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiQuery({ name: 'status', required: true, enum: BuyAdStatus })
    @ApiQuery({ name: 'language', required: false, enum: Language })
    @ApiResponse({ status: 200, description: 'وضعیت با موفقیت تغییر کرد' })
    @ApiResponse({ status: 400, description: 'تغییر وضعیت مجاز نیست' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('status') status: BuyAdStatus,
        @CurrentUser() user: any,
        @Query('language') language: Language = Language.fa,
    ) {
        return this.buyAdService.updateStatus(id, status, user.id, language);
    }

    // ==================== آمار و گزارشات کاربر ====================
    @Get('stats/overview')
    @ApiOperation({ summary: 'دریافت آمار کلی درخواست‌های خرید کاربر' })
    @ApiQuery({ name: 'timeframe', required: false, type: String, description: 'بازه زمانی (7d, 30d, 90d, 1y)' })
    @ApiResponse({ status: 200, description: 'آمار کلی کاربر' })
    async getStats(
        @CurrentUser() user: any,
        @Query('timeframe') timeframe: string = '30d',
    ) {
        return this.buyAdService.getBuyAdStats(user.id, timeframe);
    }

    // ==================== بروزرسانی محتوای چندزبانه ====================
    @Put(':id/content')
    @ApiOperation({ summary: 'بروزرسانی محتوای چندزبانه درخواست خرید' })
    @ApiParam({ name: 'id', description: 'شناسه درخواست خرید' })
    @ApiResponse({ status: 200, description: 'محتوای چندزبانه با موفقیت بروزرسانی شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'درخواست خرید یافت نشد' })
    async updateContent(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() contents: {
            language: Language;
            name?: string;
            description?: string;
            category_name?: string;
            subcategory_name?: string;
            auto_translated?: boolean;
        }[],
        @CurrentUser() user: any,
    ) {
        return this.buyAdService.updateBuyAdContent(id, contents, user.id);
    }
}