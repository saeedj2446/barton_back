// src/category-specs/category-specs-public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CategorySpecsService } from './category-specs.service';
import { Public } from '../common/decorators/public.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('Public - Category Specs')
@Public()
@Controller('public/category-specs')
export class CategorySpecsPublicController {
    constructor(private readonly categorySpecsService: CategorySpecsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام ارتباطات دسته‌بندی و مشخصه فنی (عمومی)' })
    @ApiQuery({ name: 'category_id', required: false })
    @ApiQuery({ name: 'spec_id', required: false })
    @ApiQuery({ name: 'is_required', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @Query('category_id') category_id?: string,
        @Query('spec_id') spec_id?: string,
        @Query('is_required') is_required?: boolean,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            category_id,
            spec_id,
            is_required: is_required === undefined ? undefined : Boolean(is_required),
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.categorySpecsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت ارتباط بر اساس ID (عمومی)' })
    async findOne(
        @LanguageHeader() language: Language,
        @Param('id') id: string
    ) {
        return this.categorySpecsService.findOne(id, language);
    }

    @Get('category/:categoryId/spec/:specId')
    @ApiOperation({ summary: 'دریافت ارتباط بر اساس دسته‌بندی و مشخصه فنی (عمومی)' })
    async findByCategoryAndSpec(
        @LanguageHeader() language: Language,
        @Param('categoryId') categoryId: string,
        @Param('specId') specId: string
    ) {
        return this.categorySpecsService.findByCategoryAndSpec(categoryId, specId, language);
    }

    @Get('category/:categoryId')
    @ApiOperation({ summary: 'دریافت مشخصه‌های فنی یک دسته‌بندی (عمومی)' })
    async getByCategory(
        @LanguageHeader() language: Language,
        @Param('categoryId') categoryId: string
    ) {
        return this.categorySpecsService.getByCategory(categoryId, language);
    }

    @Get('spec/:specId')
    @ApiOperation({ summary: 'دریافت دسته‌بندی‌های یک مشخصه فنی (عمومی)' })
    async getBySpec(
        @LanguageHeader() language: Language,
        @Param('specId') specId: string
    ) {
        return this.categorySpecsService.getBySpec(specId, language);
    }
}