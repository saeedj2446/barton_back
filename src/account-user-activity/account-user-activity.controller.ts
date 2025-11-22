// src/account-user-activity/account-user-activity.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountUserActivityService } from './account-user-activity.service';
import { TrackActivityDto, TrackBatchActivitiesDto } from './dto/track-activity.dto';
import { ActivityStatsQueryDto } from './dto/activity-stats.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { PrismaService } from "../prisma/prisma.service";
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Account User Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('account-user-activities')
export class AccountUserActivityController {
    constructor(
        private readonly accountUserActivityService: AccountUserActivityService,
        private readonly prisma: PrismaService,
    ) {}

    // ==================== ثبت فعالیت‌ها ====================

    @Post('track')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'ثبت فعالیت جدید کاربر' })
    @ApiResponse({ status: 201, description: 'فعالیت با موفقیت ثبت شد' })
    @ApiResponse({ status: 400, description: 'داده‌های ورودی نامعتبر' })
    async trackActivity(
        @Request() req,
        @Body() trackDto: TrackActivityDto,
        @LanguageHeader() language: Language,
    ) {
        await this.validateUserAccess(req.user.id, trackDto.account_user_id, language);
        return this.accountUserActivityService.trackActivity(trackDto, language);
    }

    @Post('track/batch')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'ثبت دسته‌ای فعالیت‌ها' })
    @ApiResponse({ status: 201, description: 'فعالیت‌ها با موفقیت ثبت شدند' })
    async trackBatchActivities(
        @Request() req,
        @Body() batchDto: TrackBatchActivitiesDto,
        @LanguageHeader() language: Language,
    ) {
        const uniqueUserIds = [...new Set(batchDto.activities.map(a => a.account_user_id))];
        await Promise.all(
            uniqueUserIds.map(userId => this.validateUserAccess(req.user.id, userId, language))
        );
        return this.accountUserActivityService.trackBatchActivities(batchDto, language);
    }

    // ==================== بازیابی فعالیت‌ها ====================

    @Get('my/recent')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت فعالیت‌های اخیر کاربر جاری' })
    async getMyRecentActivities(
        @Request() req,
        @LanguageHeader() language: Language,
        @Query('limit') limit: number = 20,
    ) {
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            return [];
        }
        return this.accountUserActivityService.getRecentActivities(accountUser.id, limit, language);
    }

    @Get('my/history')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'تاریخچه کامل فعالیت‌های کاربر جاری' })
    async getMyActivityHistory(
        @Request() req,
        @Query() query: ActivityStatsQueryDto,
        @LanguageHeader() language: Language,
    ) {
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
        }
        return this.accountUserActivityService.getActivitiesByUser(accountUser.id, query, language);
    }

    @Get('user/:accountUserId/history')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'تاریخچه فعالیت‌های کاربر خاص (ادمین)' })
    async getUserActivityHistory(
        @Param('accountUserId') accountUserId: string,
        @Query() query: ActivityStatsQueryDto,
        @LanguageHeader() language: Language,
    ) {
        return this.accountUserActivityService.getActivitiesByUser(accountUserId, query, language);
    }

    // ==================== آمار و گزارش‌ها ====================

    @Get('my/stats')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'آمار فعالیت‌های کاربر جاری' })
    async getMyActivityStats(
        @Request() req,
        @Query() query: ActivityStatsQueryDto,
        @LanguageHeader() language: Language,
    ) {
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            return this.getEmptyStats();
        }
        return this.accountUserActivityService.getUserActivityStats(accountUser.id, query, language);
    }

    @Get('account/:accountId/stats')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'آمار فعالیت‌های یک اکانت (ادمین)' })
    async getAccountActivityStats(
        @Param('accountId') accountId: string,
        @Query() query: ActivityStatsQueryDto,
        @LanguageHeader() language: Language,
    ) {
        return this.accountUserActivityService.getAccountActivityStats(accountId, query, language);
    }

    @Get('user/:accountUserId/stats')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'آمار فعالیت‌های کاربر خاص (ادمین)' })
    async getUserStats(
        @Param('accountUserId') accountUserId: string,
        @Query() query: ActivityStatsQueryDto,
        @LanguageHeader() language: Language,
    ) {
        return this.accountUserActivityService.getUserActivityStats(accountUserId, query, language);
    }

    // ==================== تحلیل الگوها ====================

    @Get('my/patterns')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'الگوهای فعالیت کاربر جاری' })
    async getMyActivityPatterns(
        @Request() req,
        @LanguageHeader() language: Language,
    ) {
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            return this.getEmptyPatterns();
        }
        return this.accountUserActivityService.getUserActivityPatterns(accountUser.id, language);
    }

    @Get('user/:accountUserId/patterns')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'الگوهای فعالیت کاربر خاص (ادمین)' })
    async getUserActivityPatterns(
        @Param('accountUserId') accountUserId: string,
        @LanguageHeader() language: Language,
    ) {
        return this.accountUserActivityService.getUserActivityPatterns(accountUserId, language);
    }

    @Get('product/:productId/engagement')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'تحلیل تعامل با یک محصول' })
    async getProductEngagement(
        @Param('productId') productId: string,
        @Query('days') days: number = 30,
        @LanguageHeader() language: Language,
    ) {
        return this.accountUserActivityService.getProductEngagement(productId, days, language);
    }

    // ==================== متدهای کمکی ====================

    private async validateUserAccess(userId: string, accountUserId: string, language: Language) {
        const accountUser = await this.prisma.accountUser.findUnique({
            where: {
                id: accountUserId,
                user_id: userId
            }
        });

        if (!accountUser) {
            throw new Error(this.accountUserActivityService['i18nService'].t('ACCESS_DENIED', language));
        }

        return accountUser;
    }

    private async getCurrentAccountUser(userId: string) {
        return await this.prisma.accountUser.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });
    }

    private getEmptyStats() {
        return {
            user_id: null,
            period: 'all_time',
            total_activities: 0,
            today_activities: 0,
            activity_breakdown: {},
            popular_products: [],
            peak_hours: Array(24).fill(0),
            engagement_score: 0
        };
    }

    private getEmptyPatterns() {
        return {
            account_user_id: null,
            peak_hours: [],
            favorite_categories: [],
            search_habits: {
                avg_query_length: 0,
                common_filters: [],
                time_between_searches: 0
            },
            browsing_behavior: {
                avg_session_duration: 0,
                pages_per_session: 0,
                bounce_rate: 0
            },
            purchase_patterns: {
                avg_order_value: 0,
                conversion_rate: 0,
                favorite_brands: []
            },
            engagement_score: 0,
            last_updated: new Date()
        };
    }
}