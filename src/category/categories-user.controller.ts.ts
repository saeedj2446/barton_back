// src/categories/categories-user.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('User - Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/categories')
export class CategoriesUserController {
    constructor(private readonly categoriesService: CategoriesService) {}

    @Get('personalized')
    @ApiOperation({ summary: 'دریافت دسته‌بندی‌های پیشنهادی شخصی‌سازی شده' })
    @ApiResponse({ status: 200, description: 'دسته‌بندی‌های پیشنهادی دریافت شد' })
    async getPersonalizedCategories(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Query('limit') limit: number = 10
    ) {
        return this.categoriesService.getPersonalizedCategories(user.id, limit);
    }

    @Get('tree')
    @ApiOperation({ summary: 'دریافت درخت دسته‌بندی‌ها' })
    @ApiQuery({ name: 'parent_id', required: false, type: String })
    async getCategoryTree(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Query('parent_id') parentId?: string
    ) {
        return this.categoriesService.getCategoryTreeWithTracking(
            parentId || null,
            language,
            user.id,
            user.id
        );
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام دسته‌بندی‌ها' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'parent_id', required: false })
    @ApiQuery({ name: 'include_children', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Query('search') search?: string,
        @Query('parent_id') parentId?: string,
        @Query('include_children') includeChildren?: boolean,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            search,
            parent_id: parentId,
            include_children: includeChildren === true,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.categoriesService.findAllWithTracking(
            query,
            language,
            user.id,
            user.id
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت دسته‌بندی بر اساس ID' })
    @ApiQuery({ name: 'includeChildren', required: false, type: Boolean })
    async findOne(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Query('includeChildren') includeChildren?: boolean
    ) {
        return this.categoriesService.findOneWithTracking(
            id,
            language,
            includeChildren === true,
            user.id,
            user.id
        );
    }

    @Get('bId/:bId')
    @ApiOperation({ summary: 'دریافت دسته‌بندی بر اساس bId' })
    async findByBId(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Param('bId') bId: number
    ) {
        return this.categoriesService.findByBIdWithTracking(
            +bId,
            language,
            user.id,
            user.id
        );
    }

    @Get('children')
    @ApiOperation({ summary: 'دریافت فرزندان یک دسته‌بندی' })
    @ApiQuery({ name: 'parentId', required: false })
    async getChildren(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Query('parentId') parentId?: string
    ) {
        return this.categoriesService.getChildrenWithTracking(
            parentId,
            language,
            user.id,
            user.id
        );
    }

    @Get(':id/contents')
    @ApiOperation({ summary: 'دریافت تمام محتوای چندزبانه دسته‌بندی' })
    async getCategoryContents(@Param('id') id: string) {
        return this.categoriesService.getCategoryTranslations(id);
    }
}