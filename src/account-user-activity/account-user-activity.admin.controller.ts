// src/account-user-activity/account-user-activity-admin.controller.ts
import {
    Controller,
    Get,
    Delete,
    Param,
    Query,
    UseGuards,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { ActivityAnalyticsQueryDto } from "./dto/activity-analytics-query.dto";
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Admin - Account User Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
@Controller('admin/account-user-activities')
export class AccountUserActivityAdminController {
    constructor(
        private readonly accountUserActivityService: AccountUserActivityService,
    ) {}

    @Get('analytics/overview')
    @ApiOperation({ summary: 'نمای کلی آنالیتیکس فعالیت‌ها (ادمین)' })
    async getActivitiesOverview(
        @LanguageHeader() language: Language,
        @Query('days') days: number = 30,
    ) {
        return this.accountUserActivityService.getActivitiesOverview(days, language);
    }

    @Get('analytics/trends')
    @ApiOperation({ summary: 'ترندهای فعالیت‌ها (ادمین)' })
    async getActivityTrends(
        @LanguageHeader() language: Language,
        @Query() query: ActivityAnalyticsQueryDto,
    ) {
        return this.accountUserActivityService.getActivityTrends(query, language);
    }

    @Get('analytics/top-products')
    @ApiOperation({ summary: 'محصولات برتر بر اساس تعامل (ادمین)' })
    async getTopProductsByEngagement(
        @LanguageHeader() language: Language,
        @Query('limit') limit: number = 10,
        @Query('days') days: number = 30,
    ) {
        return this.accountUserActivityService.getTopProductsByEngagement(limit, days, language);
    }

    @Get('analytics/user-engagement')
    @ApiOperation({ summary: 'تحلیل تعامل کاربران (ادمین)' })
    async getUserEngagementAnalytics(
        @LanguageHeader() language: Language,
    ) {
        return this.accountUserActivityService.getUserEngagementAnalytics(language);
    }

    @Get('analytics/category-insights')
    @ApiOperation({ summary: 'بینش‌های دسته‌بندی (ادمین)' })
    async getCategoryInsights(
        @LanguageHeader() language: Language,
        @Query('days') days: number = 30,
    ) {
        return this.accountUserActivityService.getCategoryInsights(days, language);
    }

    @Delete('activity/:activityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'حذف فعالیت (ادمین)' })
    @ApiResponse({ status: 204, description: 'فعالیت با موفقیت حذف شد' })
    async deleteActivity(
        @LanguageHeader() language: Language,
        @Param('activityId') activityId: string,
    ) {
        await this.accountUserActivityService.deleteActivity(activityId, language);
    }

    @Delete('user/:accountUserId/activities')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'حذف تمام فعالیت‌های کاربر (ادمین)' })
    async deleteUserActivities(
        @LanguageHeader() language: Language,
        @Param('accountUserId') accountUserId: string,
    ) {
        await this.accountUserActivityService.deleteUserActivities(accountUserId, language);
    }

    @Get('export/csv')
    @ApiOperation({ summary: 'خروجی CSV فعالیت‌ها (ادمین)' })
    async exportActivitiesToCSV(
        @LanguageHeader() language: Language,
        @Query('start_date') startDate?: string,
        @Query('end_date') endDate?: string,
    ) {
        return this.accountUserActivityService.exportActivitiesToCSV(startDate, endDate, language);
    }
}