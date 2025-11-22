// src/catalogs/catalogs-public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { Public } from '../common/decorators/public.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { CatalogStatus, Language } from '@prisma/client';

@ApiTags('Public - Catalogs')
@Public()
@Controller('public/catalogs')
export class CatalogsPublicController {
    constructor(private readonly catalogsService: CatalogsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت کاتالوگ‌های عمومی' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'brand_id', required: false })
    @ApiQuery({ name: 'category_id', required: false })
    @ApiQuery({ name: 'manufacturer_account_id', required: false })
    @ApiQuery({ name: 'status', required: false, enum: CatalogStatus })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @Query('search') search?: string,
        @Query('brand_id') brand_id?: string,
        @Query('category_id') category_id?: string,
        @Query('manufacturer_account_id') manufacturer_account_id?: string,
        @Query('status') status?: CatalogStatus,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            search,
            brand_id,
            category_id,
            manufacturer_account_id,
            status,
            is_public: true, // فقط کاتالوگ‌های عمومی
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.catalogsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت کاتالوگ بر اساس ID (عمومی)' })
    async findOne(
        @LanguageHeader() language: Language,
        @Param('id') id: string
    ) {
        return this.catalogsService.findOne(id, language);
    }
}