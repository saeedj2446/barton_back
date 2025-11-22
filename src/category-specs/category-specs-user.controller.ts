// src/category-specs/category-specs-user.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CategorySpecsService } from './category-specs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('User - Category Specs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/category-specs')
export class CategorySpecsUserController {
    constructor(private readonly categorySpecsService: CategorySpecsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام ارتباطات دسته‌بندی و مشخصه فنی' })
    @ApiQuery({ name: 'category_id', required: false })
    @ApiQuery({ name: 'spec_id', required: false })
    @ApiQuery({ name: 'is_required', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
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
    @ApiOperation({ summary: 'دریافت ارتباط بر اساس ID' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.categorySpecsService.findOne(id, language);
    }

    @Get('category/:categoryId/spec/:specId')
    @ApiOperation({ summary: 'دریافت ارتباط بر اساس دسته‌بندی و مشخصه فنی' })
    async findByCategoryAndSpec(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('categoryId') categoryId: string,
        @Param('specId') specId: string
    ) {
        return this.categorySpecsService.findByCategoryAndSpec(categoryId, specId, language);
    }

    @Get('category/:categoryId')
    @ApiOperation({ summary: 'دریافت مشخصه‌های فنی یک دسته‌بندی' })
    async getByCategory(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('categoryId') categoryId: string
    ) {
        return this.categorySpecsService.getByCategory(categoryId, language);
    }

    @Get('spec/:specId')
    @ApiOperation({ summary: 'دریافت دسته‌بندی‌های یک مشخصه فنی' })
    async getBySpec(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('specId') specId: string
    ) {
        return this.categorySpecsService.getBySpec(specId, language);
    }
}