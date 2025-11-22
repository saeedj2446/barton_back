// src/messages/admin-messages.controller.ts
import {
    Controller,
    Get,
    Param,
    Delete,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException, Post
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { MessageQueryDto } from './dto/message-query.dto';
import { Language, SystemRole } from '@prisma/client';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { LanguageHeader } from "../common/decorators/language.decorator";

@ApiTags('Admin - Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
@Controller('admin/messages')
export class AdminMessagesController {
    constructor(private readonly messagesService: MessagesService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام پیام‌ها (برای ادمین)' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
    @ApiQuery({ name: 'conversationId', required: false, description: 'فیلتر بر اساس مکالمه' })
    @ApiQuery({ name: 'userId', required: false, description: 'فیلتر بر اساس کاربر' })
    @ApiResponse({ status: 200, description: 'لیست پیام‌ها بازگشت داده شد' })
    async findAll(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query() query: MessageQueryDto & {
            conversationId?: string;
            userId?: string;
        }
    ) {
        return this.messagesService.findAllForAdmin({
            ...query,
            language
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات کامل یک پیام (برای ادمین)' })
    @ApiParam({ name: 'id', description: 'آیدی پیام' })
    @ApiResponse({ status: 200, description: 'اطلاعات پیام بازگشت داده شد' })
    @ApiResponse({ status: 404, description: 'پیام یافت نشد' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.messagesService.getMessageForAdmin(id, language);
    }

    @Get('conversation/:conversationId')
    @ApiOperation({ summary: 'دریافت پیام‌های یک مکالمه (برای ادمین)' })
    @ApiParam({ name: 'conversationId', description: 'آیدی مکالمه' })
    @ApiResponse({ status: 200, description: 'لیست پیام‌ها بازگشت داده شد' })
    @ApiResponse({ status: 404, description: 'مکالمه یافت نشد' })
    async getConversationMessages(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('conversationId') conversationId: string,
        @Query() query: MessageQueryDto
    ) {
        return this.messagesService.getConversationMessagesForAdmin(conversationId, {
            ...query,
            language
        });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف پیام (برای ادمین)' })
    @ApiParam({ name: 'id', description: 'آیدی پیام' })
    @ApiResponse({ status: 200, description: 'پیام با موفقیت حذف شد' })
    @ApiResponse({ status: 404, description: 'پیام یافت نشد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.messagesService.deleteMessageForAdmin(id);
    }

    @Get('user/:userId')
    @ApiOperation({ summary: 'دریافت پیام‌های یک کاربر (برای ادمین)' })
    @ApiParam({ name: 'userId', description: 'آیدی کاربر' })
    @ApiResponse({ status: 200, description: 'لیست پیام‌های کاربر بازگشت داده شد' })
    @ApiResponse({ status: 404, description: 'کاربر یافت نشد' })
    async getUserMessages(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('userId') userId: string,
        @Query() query: MessageQueryDto
    ) {
        return this.messagesService.getUserMessagesForAdmin(userId, {
            ...query,
            language
        });
    }

    @Get('statistics/overview')
    @ApiOperation({ summary: 'آمار کلی پیام‌رسانی (برای ادمین)' })
    @ApiQuery({ name: 'days', required: false, type: Number, example: 30, description: 'تعداد روزهای گذشته' })
    @ApiResponse({ status: 200, description: 'آمار کلی بازگشت داده شد' })
    async getStatistics(
        @CurrentUser() user: any,
        @Query('days') days: number = 30
    ) {
        if (days < 1 || days > 365) {
            throw new BadRequestException('تعداد روزها باید بین ۱ تا ۳۶۵ باشد');
        }
        return this.messagesService.getPlatformMessagingStatistics(days);
    }

    @Post('bulk/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'علامت زدن چندین پیام به عنوان خوانده شده (برای ادمین)' })
    @ApiQuery({ name: 'messageIds', required: true, description: 'آیدی‌های پیام‌ها (جداشده با کاما)' })
    @ApiResponse({ status: 200, description: 'پیام‌ها خوانده شدند' })
    async markMultipleAsRead(
        @CurrentUser() user: any,
        @Query('messageIds') messageIds: string
    ) {
        const ids = messageIds.split(',').map(id => id.trim()).filter(id => id);
        if (ids.length === 0) {
            throw new BadRequestException('حداقل یک آیدی پیام required است');
        }
        return this.messagesService.markMessagesAsRead(ids, user.id);
    }

    // آنالیز و گزارش‌های پیشرفته
    @Get('analytics/top-users')
    @ApiOperation({ summary: 'دریافت کاربران پرچت' })
    @ApiQuery({ name: 'days', required: false, type: Number, example: 7 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiResponse({ status: 200, description: 'لیست کاربران پرچت بازگشت داده شد' })
    async getTopChattingUsers(
        @CurrentUser() user: any,
        @Query('days') days: number = 7,
        @Query('limit') limit: number = 20
    ) {
        return this.messagesService.getTopChattingUsers(days, limit);
    }

    @Get('analytics/buy-ad-conversations')
    @ApiOperation({ summary: 'دریافت چت‌های مرتبط با درخواست خرید' })
    @ApiQuery({ name: 'days', required: false, type: Number, example: 30 })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiResponse({ status: 200, description: 'لیست چت‌های درخواست خرید بازگشت داده شد' })
    async getBuyAdConversations(
        @CurrentUser() user: any,
        @Query('days') days: number = 30,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ) {
        return this.messagesService.getBuyAdConversations(days, page, limit);
    }

    @Get('analytics/user/:userId/conversations')
    @ApiOperation({ summary: 'دریافت تمام چت‌های یک کاربر' })
    @ApiParam({ name: 'userId', description: 'آیدی کاربر' })
    @ApiQuery({ name: 'days', required: false, type: Number, example: 30 })
    @ApiResponse({ status: 200, description: 'چت‌های کاربر بازگشت داده شد' })
    @ApiResponse({ status: 404, description: 'کاربر یافت نشد' })
    async getUserConversations(
        @CurrentUser() user: any,
        @Param('userId') userId: string,
        @Query('days') days: number = 30
    ) {
        return this.messagesService.getUserConversationsForAdmin(userId, days);
    }

    @Get('analytics/active-conversations')
    @ApiOperation({ summary: 'دریافت چت‌های فعال اخیر' })
    @ApiQuery({ name: 'hours', required: false, type: Number, example: 24 })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiResponse({ status: 200, description: 'لیست چت‌های فعال بازگشت داده شد' })
    async getActiveConversations(
        @CurrentUser() user: any,
        @Query('hours') hours: number = 24,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20
    ) {
        return this.messagesService.getActiveConversations(hours, page, limit);
    }

    @Get('analytics/trends')
    @ApiOperation({ summary: 'تحلیل روندهای چت‌ها' })
    @ApiQuery({ name: 'days', required: false, type: Number, example: 7 })
    @ApiResponse({ status: 200, description: 'تحلیل روندها بازگشت داده شد' })
    async getChatTrends(
        @CurrentUser() user: any,
        @Query('days') days: number = 7
    ) {
        return this.messagesService.getChatTrendsAnalysis(days);
    }
}