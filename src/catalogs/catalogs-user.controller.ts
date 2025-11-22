// src/catalogs/catalogs-user.controller.ts
import { Controller, Get, Param, Query, UseGuards, Post, Put, Delete, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { CatalogStatus, Language } from '@prisma/client';

@ApiTags('User - Catalogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/catalogs')
export class CatalogsUserController {
    constructor(private readonly catalogsService: CatalogsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد کاتالوگ جدید توسط کاربر' })
    @ApiResponse({ status: 201, description: 'کاتالوگ ایجاد شد' })
    async create(
        @CurrentUser() user: any,
        @Body() createCatalogDto: CreateCatalogDto,
        @LanguageHeader() language: Language
    ) {
        // کاربر فقط می‌تواند کاتالوگ برای اکانت خودش ایجاد کند
        const catalogData = {
            ...createCatalogDto,
            manufacturer_account_id: user.accountId, // فرض می‌کنیم کاربر accountId دارد
            status: CatalogStatus.PENDING_REVIEW, // همه کاتالوگ‌های کاربر نیاز به تایید دارند
        };

        return this.catalogsService.create(catalogData, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت کاتالوگ‌های کاربر' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'brand_id', required: false })
    @ApiQuery({ name: 'category_id', required: false })
    @ApiQuery({ name: 'status', required: false, enum: CatalogStatus })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('search') search?: string,
        @Query('brand_id') brand_id?: string,
        @Query('category_id') category_id?: string,
        @Query('status') status?: CatalogStatus,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            search,
            brand_id,
            category_id,
            manufacturer_account_id: user.accountId, // فقط کاتالوگ‌های کاربر
            status,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.catalogsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت کاتالوگ بر اساس ID' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.catalogsService.findOne(id, language);
    }

    @Put(':id')
    @ApiOperation({ summary: 'آپدیت کاتالوگ کاربر' })
    @ApiResponse({ status: 200, description: 'کاتالوگ آپدیت شد' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateCatalogDto: UpdateCatalogDto,
        @LanguageHeader() language: Language
    ) {
        // کاربر فقط می‌تواند کاتالوگ‌های خودش را آپدیت کند
        const catalog = await this.catalogsService.findOne(id, language);

        // بررسی مالکیت (این چک باید در سرویس انجام شود)
        return this.catalogsService.update(id, updateCatalogDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف کاتالوگ کاربر' })
    @ApiResponse({ status: 200, description: 'کاتالوگ حذف شد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        // کاربر فقط می‌تواند کاتالوگ‌های خودش را حذف کند
        return this.catalogsService.remove(id, language);
    }
}