// src/reviews/public-reviews.controller.ts
import { Controller, Get, Query, Param } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LanguageHeader } from "../common/decorators/language.decorator";
import { Language } from '@prisma/client';

@ApiTags('Public - Reviews')
@Controller('reviews')
export class PublicReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت نظرات (عمومی)' })
    findAll(
        @Query() query: ReviewQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findAll({ ...query, confirmed: true, language });
    }

    @Get('product/:productId')
    @ApiOperation({ summary: 'دریافت نظرات یک محصول' })
    findByProduct(
        @Param('productId') productId: string,
        @Query() query: ReviewQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findAll({
            ...query,
            product_id: productId,
            confirmed: true,
            language
        });
    }

    @Get('account/:accountId')
    @ApiOperation({ summary: 'دریافت نظرات یک حساب' })
    findByAccount(
        @Param('accountId') accountId: string,
        @Query() query: ReviewQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findAll({
            ...query,
            account_id: accountId,
            confirmed: true,
            language
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت یک نظر' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findOne(id, language);
    }
}