// src/user-behavior/user-behavior.admin.controller.ts
import {
    Controller,
    Get,
    Delete,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    Headers,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiHeader,
} from '@nestjs/swagger';
import { UserBehaviorService } from './user-behavior.service';
import { UserBehaviorQueryDto } from './dto/user-behavior-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';

@ApiTags('Admin - User Behavior')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
@Controller('admin/user-behavior')
export class UserBehaviorAdminController {
    constructor(
        private readonly userBehaviorService: UserBehaviorService,
        private readonly i18nService: I18nService,
    ) {}

    private getLanguageFromHeaders(@Headers() headers: any): Language {
        const acceptLanguage = headers['accept-language'] || 'fa';
        switch (acceptLanguage.toLowerCase()) {
            case 'en':
            case 'en-us':
                return Language.en;
            case 'ar':
                return Language.ar;
            case 'fa':
            default:
                return Language.fa;
        }
    }

    @Delete('activities/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'حذف فعالیت (ادمین)' })
    @ApiResponse({ status: 204, description: 'فعالیت با موفقیت حذف شد' })
    @ApiResponse({ status: 404, description: 'فعالیت یافت نشد' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async deleteActivity(
        @Param('id') id: string,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        await this.userBehaviorService.deleteActivity(id, language);
    }

    @Delete('behavior/:accountUserId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'حذف رفتار کاربر (ادمین)' })
    @ApiResponse({ status: 204, description: 'رفتار با موفقیت حذف شد' })
    @ApiResponse({ status: 404, description: 'رفتار یافت نشد' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async deleteBehavior(
        @Param('accountUserId') accountUserId: string,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        await this.userBehaviorService.deleteBehavior(accountUserId, language);
    }

    @Get('analytics/trends')
    @ApiOperation({ summary: 'تحلیل ترندهای فعالیت‌ها (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getActivityTrends(
        @Headers() headers: any,
        @Query('days') days: number = 30,
        @Query('activity_type') activityType?: string,

    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getActivityTrends(days, activityType, language);
    }

    @Get('analytics/popular-products')
    @ApiOperation({ summary: 'محصولات محبوب بر اساس فعالیت‌ها (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getPopularProducts(
        @Query('limit') limit: number = 10,
        @Query('days') days: number = 30,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getPopularProducts(limit, days, language);
    }

    @Get('analytics/user-engagement')
    @ApiOperation({ summary: 'تحلیل تعامل کاربران (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getUserEngagementMetrics(@Headers() headers: any) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getUserEngagementMetrics(language);
    }

    @Get('analytics/activities')
    @ApiOperation({ summary: 'گزارش کامل فعالیت‌ها (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getActivitiesReport(
        @Query() query: UserBehaviorQueryDto,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getActivities(query, language);
    }
}