// src/comments/admin-comments.controller.ts
import { Controller, Get, Patch, Param, Delete, Query, UseGuards, Body, Put } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { SystemRole, Language } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LanguageHeader } from "../common/decorators/language.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags('Admin - Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/comments')
export class AdminCommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Get()
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'دریافت تمام کامنت‌ها (ادمین)' })
    findAll(
        @Query() query: CommentQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findAll({ ...query, language });
    }

    @Get(':id')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'دریافت یک کامنت' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findOne(id, language);
    }

    @Patch(':id')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'ویرایش کامنت' })
    update(
        @Param('id') id: string,
        @Body() updateCommentDto: UpdateCommentDto,
        @LanguageHeader() language: Language
    ) {
        // برای ادمین، userId رو null می‌فرستیم تا بررسی دسترسی نشود
        return this.commentsService.update(id, updateCommentDto, null, language);
    }

    @Put(':id/confirm')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'تأیید کامنت' })
    confirm(
        @Param('id') id: string,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.confirmComment(id, user.id, language);
    }

    @Delete(':id')
    @Roles(SystemRole.ADMIN)
    @ApiOperation({ summary: 'حذف کامنت (ادمین)' })
    remove(@Param('id') id: string) {
        // برای ادمین، userId رو null می‌فرستیم تا بررسی دسترسی نشود
        return this.commentsService.remove(id, null);
    }

    @Get('stats/overview')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'آمار کلی کامنت‌ها' })
    async getStats(@Query('timeframe') timeframe: string = '30d') {
        return this.commentsService.getCommentStats(timeframe);
    }
}