// src/comments/user-comments.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { LanguageHeader } from "../common/decorators/language.decorator";
import { Language } from '@prisma/client';

@ApiTags('User - Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/comments')
export class UserCommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Post()
    @ApiOperation({ summary: 'ثبت کامنت جدید' })
    create(
        @Body() createCommentDto: CreateCommentDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.create(createCommentDto, req.user.id, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت کامنت‌های کاربر' })
    findAll(
        @Query() query: CommentQueryDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findAll({ ...query, user_id: req.user.id, language });
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت یک کامنت' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findOne(id, language);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'ویرایش کامنت' })
    update(
        @Param('id') id: string,
        @Body() updateCommentDto: UpdateCommentDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.update(id, updateCommentDto, req.user.id, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف کامنت' })
    remove(@Param('id') id: string, @Req() req: any) {
        return this.commentsService.remove(id, req.user.id);
    }

    @Post(':id/like')
    @ApiOperation({ summary: 'لایک کردن کامنت' })
    like(@Param('id') id: string, @Req() req: any) {
        return this.commentsService.likeComment(id, req.user.id);
    }
}