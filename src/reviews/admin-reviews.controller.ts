// src/reviews/admin-reviews.controller.ts
import { Controller, Get, Patch, Param, Delete, Query, UseGuards, Body, Put } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { SystemRole, Language } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LanguageHeader } from "../common/decorators/language.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags('Admin - Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/reviews')
export class AdminReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Get()
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'دریافت تمام نظرات (ادمین)' })
    findAll(
        @Query() query: ReviewQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findAll({ ...query, language });
    }

    @Get(':id')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'دریافت یک نظر' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.findOne(id, language);
    }

    @Patch(':id')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'ویرایش نظر' })
    update(
        @Param('id') id: string,
        @Body() updateReviewDto: UpdateReviewDto,
        @LanguageHeader() language: Language
    ) {
        // برای ادمین، userId رو null می‌فرستیم تا بررسی دسترسی نشود
        return this.reviewsService.update(id, updateReviewDto, null, language);
    }

    @Put(':id/confirm')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({ summary: 'تأیید نظر' })
    confirm(
        @Param('id') id: string,
        @CurrentUser() user: any,
        @LanguageHeader() language: Language
    ) {
        return this.reviewsService.confirmReview(id, user.id, language);
    }

    @Delete(':id')
    @Roles(SystemRole.ADMIN)
    @ApiOperation({ summary: 'حذف نظر (ادمین)' })
    remove(@Param('id') id: string) {
        // برای ادمین، userId رو null می‌فرستیم تا بررسی دسترسی نشود
        return this.reviewsService.remove(id, null);
    }

    @Get('stats/overview')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'آمار کلی نظرات' })
    async getStats(@Query('timeframe') timeframe: string = '30d') {
        return this.reviewsService.getReviewStats(timeframe);
    }
}