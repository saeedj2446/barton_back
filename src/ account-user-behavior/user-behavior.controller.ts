// src/user-behavior/user-behavior.controller.ts
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
    ParseArrayPipe,
    Headers, NotFoundException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiHeader,
} from '@nestjs/swagger';
import { UserBehaviorService } from './user-behavior.service';
import { CreateAccountUserActivityDto } from './dto/create-account-user-activity.dto';
import { UpdateAccountUserBehaviorDto } from './dto/update-account-user-behavior.dto';
import { UserBehaviorQueryDto } from './dto/user-behavior-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { PrismaService } from "../prisma/prisma.service";
import { I18nService } from '../i18n/i18n.service';

@ApiTags('User Behavior')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('user-behavior')
export class UserBehaviorController {
    constructor(
        private readonly userBehaviorService: UserBehaviorService,
        private readonly prisma: PrismaService,
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

    // ==================== فعالیت‌ها ====================

    @Post('activities')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'ثبت فعالیت جدید کاربر' })
    @ApiResponse({ status: 201, description: 'فعالیت با موفقیت ثبت شد' })
    @ApiResponse({ status: 404, description: 'رابطه کاربر-اکانت یافت نشد' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async createActivity(
        @Request() req,
        @Body() createDto: CreateAccountUserActivityDto,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);

        // اعتبارسنجی که کاربر به این account_user_id دسترسی دارد
        await this.validateAccountUserAccess(req.user.id, createDto.account_user_id, language);

        return this.userBehaviorService.createActivity(createDto, language);
    }

    @Post('activities/batch')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'ثبت دسته‌ای فعالیت‌ها' })
    @ApiBody({ type: [CreateAccountUserActivityDto] })
    @ApiResponse({ status: 201, description: 'فعالیت‌ها با موفقیت ثبت شدند' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async createBatchActivities(
        @Request() req,
        @Body(new ParseArrayPipe({ items: CreateAccountUserActivityDto }))
            createDtos: CreateAccountUserActivityDto[],
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);

        // اعتبارسنجی دسترسی برای همه فعالیت‌ها
        await Promise.all(
            createDtos.map(dto =>
                this.validateAccountUserAccess(req.user.id, dto.account_user_id, language)
            )
        );

        return this.userBehaviorService.createBatchActivities(createDtos, language);
    }

    @Get('activities')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت تمام فعالیت‌ها (ادمین)' })
    @ApiResponse({ status: 200, description: 'لیست فعالیت‌ها بازگردانده شد' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getActivities(
        @Query() query: UserBehaviorQueryDto,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getActivities(query, language);
    }

    @Get('activities/my')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت فعالیت‌های کاربر جاری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getMyActivities(
        @Request() req,
        @Query() query: UserBehaviorQueryDto,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);

        // پیدا کردن account_user_id مربوط به کاربر جاری
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            return {
                data: [],
                meta: {
                    total: 0,
                    page: 1,
                    limit: 20,
                    totalPages: 0,
                    summary: {
                        total_activities: 0,
                        by_type: {},
                        by_account_user: {}
                    }
                }
            };
        }

        return this.userBehaviorService.getUserActivities(accountUser.id, query, language);
    }

    @Get('activities/user/:accountUserId')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت فعالیت‌های کاربر خاص (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getUserActivities(
        @Param('accountUserId') accountUserId: string,
        @Query() query: UserBehaviorQueryDto,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getUserActivities(accountUserId, query, language);
    }

    // ==================== رفتارها ====================

    @Get('behavior/my')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت رفتار کاربر جاری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getMyBehavior(
        @Request() req,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            return await this.userBehaviorService.getBehavior('default', language);
        }

        return this.userBehaviorService.getBehavior(accountUser.id, language);
    }

    @Get('behavior/user/:accountUserId')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت رفتار کاربر خاص (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getUserBehavior(
        @Param('accountUserId') accountUserId: string,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getBehavior(accountUserId, language);
    }

    @Post('behavior/my/analyze')
    @HttpCode(HttpStatus.OK)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'تحلیل و بروزرسانی رفتار کاربر جاری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async analyzeMyBehavior(
        @Request() req,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            throw new NotFoundException(
                this.i18nService.t('RECORD_NOT_FOUND', language)
            );
        }

        return this.userBehaviorService.analyzeAndUpdateBehavior(accountUser.id, language);
    }

    @Post('behavior/user/:accountUserId/analyze')
    @HttpCode(HttpStatus.OK)
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'تحلیل و بروزرسانی رفتار کاربر خاص (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async analyzeUserBehavior(
        @Param('accountUserId') accountUserId: string,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.analyzeAndUpdateBehavior(accountUserId, language);
    }

    // ==================== آمار و گزارش‌ها ====================

    @Get('stats/global')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'آمار کلی فعالیت‌ها (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getGlobalStats(@Headers() headers: any) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getActivityStats(undefined, language);
    }

    @Get('stats/my')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'آمار فعالیت‌های کاربر جاری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getMyStats(
        @Request() req,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        const accountUser = await this.getCurrentAccountUser(req.user.id);
        if (!accountUser) {
            return {
                total_activities: 0,
                today_activities: 0,
                unique_users: 0,
                popular_activities: {},
                activity_trend: [],
                hourly_breakdown: Array(24).fill(0)
            };
        }

        return this.userBehaviorService.getActivityStats(accountUser.id, language);
    }

    @Get('stats/user/:accountUserId')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'آمار فعالیت‌های کاربر خاص (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getUserStats(
        @Param('accountUserId') accountUserId: string,
        @Headers() headers: any,
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.userBehaviorService.getActivityStats(accountUserId, language);
    }

    // ==================== متدهای کمکی ====================

    private async validateAccountUserAccess(userId: string, accountUserId: string, language: Language) {
        const accountUser = await this.prisma.accountUser.findUnique({
            where: {
                id: accountUserId,
                user_id: userId  // اطمینان از تعلق به کاربر جاری
            }
        });

        if (!accountUser) {
            throw new NotFoundException(
                this.i18nService.t('ACCESS_DENIED', language)
            );
        }

        return accountUser;
    }

    private async getCurrentAccountUser(userId: string) {
        // این منطق بستگی به سیستم مدیریت اکانت جاری شما دارد
        // به عنوان مثال ساده، اولین اکانت کاربر را برمی‌گردانیم
        return await this.prisma.accountUser.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });
    }
}