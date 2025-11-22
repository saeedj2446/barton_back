// src/reviews/user-reviews.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { LanguageHeader } from "../common/decorators/language.decorator";
import { Language } from '@prisma/client';

@ApiTags('User - Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/reviews')
export class UserReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Post()
    @ApiOperation({ summary: 'ثبت نظر جدید' })
    create(
        @Body() createReviewDto: CreateReviewDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.create(createReviewDto, req.user.id, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت نظرات کاربر' })
    findAll(
        @Query() query: ReviewQueryDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findAll({ ...query, user_id: req.user.id, language });
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت یک نظر' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findOne(id, language);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'ویرایش نظر' })
    update(
        @Param('id') id: string,
        @Body() updateReviewDto: UpdateReviewDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.update(id, updateReviewDto, req.user.id, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف نظر' })
    remove(@Param('id') id: string, @Req() req: any) {
        return this.reviewsService.remove(id, req.user.id);
    }

    @Post(':id/like')
    @ApiOperation({ summary: 'لایک کردن نظر' })
    like(@Param('id') id: string, @Req() req: any) {
        return this.reviewsService.likeReview(id, req.user.id);
    }
}