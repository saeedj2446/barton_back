// src/comments/public-comments.controller.ts
import { Controller, Get, Query, Param } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentQueryDto } from './dto/comment-query.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LanguageHeader } from "../common/decorators/language.decorator";
import { Language } from '@prisma/client';

@ApiTags('Public - Comments')
@Controller('comments')
export class PublicCommentsController {
    constructor(private readonly commentsService: CommentsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت کامنت‌ها (عمومی)' })
    findAll(
        @Query() query: CommentQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findAll({ ...query, confirmed: true, language });
    }

    @Get('product/:productId')
    @ApiOperation({ summary: 'دریافت کامنت‌های یک محصول' })
    findByProduct(
        @Param('productId') productId: string,
        @Query() query: CommentQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findAll({
            ...query,
            product_id: productId,
            confirmed: true,
            include_replies: true,
            language
        });
    }

    @Get('account/:accountId')
    @ApiOperation({ summary: 'دریافت کامنت‌های یک حساب' })
    findByAccount(
        @Param('accountId') accountId: string,
        @Query() query: CommentQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findAll({
            ...query,
            account_id: accountId,
            confirmed: true,
            include_replies: true,
            language
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت یک کامنت' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.commentsService.findOne(id, language);
    }
}