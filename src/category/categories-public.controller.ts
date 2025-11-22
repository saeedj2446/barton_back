// src/categories/categories-public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Public } from '../common/decorators/public.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('Public - Categories')
@Public()
@Controller('public/categories')
export class CategoriesPublicController {
    constructor(private readonly categoriesService: CategoriesService) {}

    @Get('popular')
    @ApiOperation({ summary: 'دریافت دسته‌بندی‌های پرطرفدار' })
    @ApiResponse({ status: 200, description: 'دسته‌بندی‌های پرطرفدار دریافت شد' })
    async getPopularCategories(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @Query('days') days: number = 30,
        @Query('limit') limit: number = 10
    ) {
        return this.categoriesService.getPopularCategories(days, limit);
    }

    @Get('tree')
    @ApiOperation({ summary: 'دریافت درخت دسته‌بندی‌ها (عمومی)' })
    @ApiQuery({ name: 'parent_id', required: false, type: String })
    async getCategoryTree(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @Query('parent_id') parentId?: string
    ) {
        return this.categoriesService.getCategoryTree(parentId || null, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام دسته‌بندی‌ها (عمومی)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'parent_id', required: false })
    @ApiQuery({ name: 'include_children', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
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

        return this.categoriesService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت دسته‌بندی بر اساس ID (عمومی)' })
    @ApiQuery({ name: 'includeChildren', required: false, type: Boolean })
    async findOne(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @Param('id') id: string,
        @Query('includeChildren') includeChildren?: boolean
    ) {
        return this.categoriesService.findOne(id, language, includeChildren === true);
    }

    @Get('bId/:bId')
    @ApiOperation({ summary: 'دریافت دسته‌بندی بر اساس bId (عمومی)' })
    async findByBId(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @Param('bId') bId: number
    ) {
        return this.categoriesService.findByBId(+bId, language);
    }

    @Get('children')
    @ApiOperation({ summary: 'دریافت فرزندان یک دسته‌بندی (عمومی)' })
    @ApiQuery({ name: 'parentId', required: false })
    async getChildren(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @Query('parentId') parentId?: string
    ) {
        return this.categoriesService.getChildren(parentId, language);
    }

    @Get(':id/contents')
    @ApiOperation({ summary: 'دریافت تمام محتوای چندزبانه دسته‌بندی' })
    async getCategoryContents(@Param('id') id: string) {
        return this.categoriesService.getCategoryTranslations(id);
    }
}