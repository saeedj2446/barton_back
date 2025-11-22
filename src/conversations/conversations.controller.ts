// src/conversations/conversations.controller.ts
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
    HttpCode,
    HttpStatus
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد مکالمه جدید' })
    @ApiResponse({ status: 201, description: 'مکالمه با موفقیت ایجاد شد' })
    @ApiResponse({ status: 404, description: 'کاربر مورد نظر یافت نشد' })
    async create(
        @Body() createConversationDto: CreateConversationDto,
        @CurrentUser() user: any
    ) {
        return this.conversationsService.createConversation(createConversationDto, user.id);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت مکالمات کاربر' })
    @ApiResponse({ status: 200, description: 'لیست مکالمات بازگشت داده شد' })
    async findAll(
        @Query() query: ConversationQueryDto,
        @CurrentUser() user: any
    ) {
        return this.conversationsService.getUserConversations(user.id, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات یک مکالمه' })
    @ApiParam({ name: 'id', description: 'آیدی مکالمه' })
    @ApiResponse({ status: 200, description: 'اطلاعات مکالمه بازگشت داده شد' })
    @ApiResponse({ status: 404, description: 'مکالمه یافت نشد' })
    @ApiResponse({ status: 403, description: 'دسترسی به مکالمه ندارید' })
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any
    ) {
        return this.conversationsService.getConversation(id, user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف مکالمه' })
    @ApiParam({ name: 'id', description: 'آیدی مکالمه' })
    @ApiResponse({ status: 200, description: 'مکالمه با موفقیت حذف شد' })
    @ApiResponse({ status: 404, description: 'مکالمه یافت نشد' })
    @ApiResponse({ status: 403, description: 'دسترسی به مکالمه ندارید' })
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any
    ) {
        return this.conversationsService.deleteConversation(id, user.id);
    }

    @Post(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'علامت زدن تمام پیام‌های مکالمه به عنوان خوانده شده' })
    @ApiParam({ name: 'id', description: 'آیدی مکالمه' })
    @ApiResponse({ status: 200, description: 'تمام پیام‌ها خوانده شدند' })
    async markAsRead(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: any
    ) {
        return this.conversationsService.markConversationAsRead(id, user.id);
    }

    @Get('user/:userId/check')
    @ApiOperation({ summary: 'بررسی امکان ایجاد مکالمه با کاربر' })
    @ApiParam({ name: 'userId', description: 'آیدی کاربر مقابل' })
    @ApiResponse({ status: 200, description: 'اطلاعات بررسی بازگشت داده شد' })
    async checkConversationPossibility(
        @Param('userId', ParseUUIDPipe) otherUserId: string,
        @CurrentUser() user: any
    ) {
        return this.conversationsService.checkConversationPossibility(user.id, otherUserId);
    }
}