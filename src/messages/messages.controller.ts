// src/messages/messages.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    Query,
    UseGuards,
    ParseUUIDPipe,
    Put,
    HttpCode,
    HttpStatus,
    BadRequestException
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
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Language } from '@prisma/client';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) {}

    @Post()
    @ApiOperation({ summary: 'ارسال پیام جدید' })
    @ApiResponse({ status: 201, description: 'پیام با موفقیت ارسال شد' })
    @ApiResponse({ status: 404, description: 'مکالمه یافت نشد' })
    @ApiResponse({ status: 403, description: 'دسترسی به مکالمه ندارید' })
    async create(
        @Body() createMessageDto: CreateMessageDto,
        @CurrentUser() user: any
    ) {
        return this.messagesService.create(createMessageDto, user.id);
    }

    @Get('conversation/:conversationId')
    @ApiOperation({ summary: 'دریافت پیام‌های یک مکالمه' })
    @ApiParam({ name: 'conversationId', description: 'آیدی مکالمه' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
    @ApiQuery({ name: 'before', required: false, type: String, description: 'برای اسکرول بی‌نهایت' })
    @ApiQuery({ name: 'language', required: false, enum: Language, example: Language.fa })
    @ApiResponse({ status: 200, description: 'لیست پیام‌ها بازگشت داده شد' })
    @ApiResponse({ status: 404, description: 'مکالمه یافت نشد' })
    @ApiResponse({ status: 403, description: 'دسترسی به مکالمه ندارید' })
    async getConversationMessages(
        @Param('conversationId') conversationId: string,
        @Query() query: MessageQueryDto & { language?: Language },
        @CurrentUser() user: any
    ) {
        return this.messagesService.getConversationMessages(conversationId, user.id, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات یک پیام' })
    @ApiParam({ name: 'id', description: 'آیدی پیام' })
    @ApiQuery({ name: 'language', required: false, enum: Language, example: Language.fa })
    @ApiResponse({ status: 200, description: 'اطلاعات پیام بازگشت داده شد' })
    @ApiResponse({ status: 404, description: 'پیام یافت نشد' })
    @ApiResponse({ status: 403, description: 'دسترسی به پیام ندارید' })
    async findOne(
        @Param('id') id: string,
        @Query('language') language: Language = Language.fa,
        @CurrentUser() user: any
    ) {
        return this.messagesService.getMessage(id, user.id, language);
    }

    @Put(':id')
    @ApiOperation({ summary: 'ویرایش پیام' })
    @ApiParam({ name: 'id', description: 'آیدی پیام' })
    @ApiResponse({ status: 200, description: 'پیام با موفقیت ویرایش شد' })
    @ApiResponse({ status: 404, description: 'پیام یافت نشد' })
    @ApiResponse({ status: 403, description: 'شما فقط می‌توانید پیام‌های خود را ویرایش کنید' })
    @ApiResponse({ status: 400, description: 'زمان ویرایش پیام به پایان رسیده است' })
    async update(
        @Param('id') id: string,
        @Body('content') content: string,
        @CurrentUser() user: any
    ) {
        if (!content || content.trim().length === 0) {
            throw new BadRequestException('محتوی پیام نمی‌تواند خالی باشد');
        }
        return this.messagesService.updateMessage(id, content, user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف پیام' })
    @ApiParam({ name: 'id', description: 'آیدی پیام' })
    @ApiResponse({ status: 200, description: 'پیام با موفقیت حذف شد' })
    @ApiResponse({ status: 404, description: 'پیام یافت نشد' })
    @ApiResponse({ status: 403, description: 'شما فقط می‌توانید پیام‌های خود را حذف کنید' })
    async remove(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.messagesService.deleteMessage(id, user.id);
    }

    @Post(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'علامت زدن پیام به عنوان خوانده شده' })
    @ApiParam({ name: 'id', description: 'آیدی پیام' })
    @ApiResponse({ status: 200, description: 'پیام خوانده شد' })
    @ApiResponse({ status: 404, description: 'پیام یافت نشد' })
    async markAsRead(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.messagesService.markMessagesAsRead([id], user.id);
    }

    @Get('conversation/:conversationId/search')
    @ApiOperation({ summary: 'جستجو در پیام‌های یک مکالمه' })
    @ApiParam({ name: 'conversationId', description: 'آیدی مکالمه' })
    @ApiQuery({ name: 'q', required: true, description: 'عبارت جستجو' })
    @ApiQuery({ name: 'language', required: false, enum: Language, example: Language.fa })
    @ApiResponse({ status: 200, description: 'نتایج جستجو بازگشت داده شد' })
    @ApiResponse({ status: 403, description: 'دسترسی به مکالمه ندارید' })
    async searchMessages(
        @Param('conversationId') conversationId: string,
        @Query('q') searchTerm: string,
        @Query('language') language: Language = Language.fa,
        @CurrentUser() user: any
    ) {
        if (!searchTerm || searchTerm.trim().length < 2) {
            throw new BadRequestException('عبارت جستجو باید حداقل ۲ کاراکتر باشد');
        }
        return this.messagesService.searchMessages(conversationId, user.id, searchTerm.trim(), language);
    }

    @Get('user/statistics')
    @ApiOperation({ summary: 'آمار پیام‌های کاربر' })
    @ApiQuery({ name: 'days', required: false, type: Number, example: 7, description: 'تعداد روزهای گذشته' })
    @ApiResponse({ status: 200, description: 'آمار بازگشت داده شد' })
    async getUserStatistics(
        @Query('days') days: number = 7,
        @CurrentUser() user: any
    ) {
        if (days < 1 || days > 365) {
            throw new BadRequestException('تعداد روزها باید بین ۱ تا ۳۶۵ باشد');
        }
        return this.messagesService.getMessagingActivity(user.id, days);
    }
}