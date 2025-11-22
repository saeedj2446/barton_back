// src/catalogs/catalogs-admin.controller.ts
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Query,
    Body,
    UseGuards
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery
} from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language, CatalogStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Admin - Catalogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
@Controller('admin/catalogs')
export class CatalogsAdminController {
    constructor(private readonly catalogsService: CatalogsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد کاتالوگ جدید' })
    @ApiResponse({ status: 201, description: 'کاتالوگ ایجاد شد' })
    @ApiResponse({ status: 409, description: 'کاتالوگ با این نام یا مدل وجود دارد' })
    async create(
        @CurrentUser() user: any,
        @Body() createCatalogDto: CreateCatalogDto,
        @LanguageHeader() language: Language
    ) {
        return this.catalogsService.create(createCatalogDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام کاتالوگ‌ها (ادمین)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'brand_id', required: false })
    @ApiQuery({ name: 'category_id', required: false })
    @ApiQuery({ name: 'manufacturer_account_id', required: false })
    @ApiQuery({ name: 'status', required: false, enum: CatalogStatus })
    @ApiQuery({ name: 'is_public', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'کاتالوگ‌ها دریافت شد' })
    async findAll(
        @CurrentUser() user: any,
        @Query() query: CatalogQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.catalogsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت کاتالوگ بر اساس ID (ادمین)' })
    @ApiResponse({ status: 200, description: 'کاتالوگ دریافت شد' })
    @ApiResponse({ status: 404, description: 'کاتالوگ پیدا نشد' })
    async findOne(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.catalogsService.findOne(id, language);
    }

    @Put(':id')
    @ApiOperation({ summary: 'آپدیت کاتالوگ' })
    @ApiResponse({ status: 200, description: 'کاتالوگ آپدیت شد' })
    @ApiResponse({ status: 404, description: 'کاتالوگ پیدا نشد' })
    @ApiResponse({ status: 409, description: 'کاتالوگ با این نام یا مدل وجود دارد' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateCatalogDto: UpdateCatalogDto,
        @LanguageHeader() language: Language
    ) {
        return this.catalogsService.update(id, updateCatalogDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف کاتالوگ' })
    @ApiResponse({ status: 200, description: 'کاتالوگ حذف شد' })
    @ApiResponse({ status: 404, description: 'کاتالوگ پیدا نشد' })
    @ApiResponse({ status: 409, description: 'امکان حذف وجود ندارد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.catalogsService.remove(id, language);
    }

    @Put(':id/approve')
    @ApiOperation({ summary: 'تایید کاتالوگ' })
    @ApiResponse({ status: 200, description: 'کاتالوگ تایید شد' })
    @ApiResponse({ status: 404, description: 'کاتالوگ پیدا نشد' })
    @ApiResponse({ status: 409, description: 'کاتالوگ قبلاً تایید شده' })
    async approve(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.catalogsService.approveCatalog(id, user.id, language);
    }

    @Put(':id/reject')
    @ApiOperation({ summary: 'رد کاتالوگ' })
    @ApiResponse({ status: 200, description: 'کاتالوگ رد شد' })
    @ApiResponse({ status: 404, description: 'کاتالوگ پیدا نشد' })
    @ApiResponse({ status: 409, description: 'کاتالوگ قبلاً رد شده' })
    async reject(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body('rejection_reason') rejectionReason: string,
        @LanguageHeader() language: Language
    ) {
        return this.catalogsService.rejectCatalog(id, user.id, rejectionReason, language);
    }
}