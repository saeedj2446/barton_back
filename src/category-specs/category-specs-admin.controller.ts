// src/category-specs/category-specs-admin.controller.ts
import {
    Controller,
    Get,
    Post,
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
import { CategorySpecsService } from './category-specs.service';
import { CreateCategorySpecDto, CreateCategorySpecBulkDto } from './dto/create-category-spec.dto';
import { CategorySpecQueryDto } from './dto/category-spec-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Admin - Category Specs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
@Controller('admin/category-specs')
export class CategorySpecsAdminController {
    constructor(private readonly categorySpecsService: CategorySpecsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد ارتباط جدید بین دسته‌بندی و مشخصه فنی' })
    @ApiResponse({ status: 201, description: 'ارتباط ایجاد شد' })
    @ApiResponse({ status: 409, description: 'این ارتباط از قبل وجود دارد' })
    async create(
        @CurrentUser() user: any,
        @Body() createCategorySpecDto: CreateCategorySpecDto,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.create(createCategorySpecDto, language);
    }

    @Post('bulk')
    @ApiOperation({ summary: 'ایجاد چندین ارتباط به صورت گروهی' })
    @ApiResponse({ status: 201, description: 'ارتباطات ایجاد شد' })
    async createBulk(
        @CurrentUser() user: any,
        @Body() createBulkDto: CreateCategorySpecBulkDto,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.createBulk(createBulkDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام ارتباطات دسته‌بندی و مشخصه فنی (ادمین)' })
    @ApiQuery({ name: 'category_id', required: false })
    @ApiQuery({ name: 'spec_id', required: false })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'ارتباطات دریافت شد' })
    async findAll(
        @CurrentUser() user: any,
        @Query() query: CategorySpecQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت ارتباط بر اساس ID (ادمین)' })
    @ApiResponse({ status: 200, description: 'ارتباط دریافت شد' })
    @ApiResponse({ status: 404, description: 'ارتباط پیدا نشد' })
    async findOne(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.findOne(id, language);
    }

    @Get('category/:categoryId/spec/:specId')
    @ApiOperation({ summary: 'دریافت ارتباط بر اساس دسته‌بندی و مشخصه فنی (ادمین)' })
    @ApiResponse({ status: 200, description: 'ارتباط دریافت شد' })
    @ApiResponse({ status: 404, description: 'ارتباط پیدا نشد' })
    async findByCategoryAndSpec(
        @CurrentUser() user: any,
        @Param('categoryId') categoryId: string,
        @Param('specId') specId: string,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.findByCategoryAndSpec(categoryId, specId, language);
    }

    @Get('category/:categoryId')
    @ApiOperation({ summary: 'دریافت مشخصه‌های فنی یک دسته‌بندی (ادمین)' })
    @ApiResponse({ status: 200, description: 'مشخصه‌ها دریافت شد' })
    async getByCategory(
        @CurrentUser() user: any,
        @Param('categoryId') categoryId: string,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.getByCategory(categoryId, language);
    }

    @Get('spec/:specId')
    @ApiOperation({ summary: 'دریافت دسته‌بندی‌های یک مشخصه فنی (ادمین)' })
    @ApiResponse({ status: 200, description: 'دسته‌بندی‌ها دریافت شد' })
    async getBySpec(
        @CurrentUser() user: any,
        @Param('specId') specId: string,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.getBySpec(specId, language);
    }

    @Delete(':categoryId/:specId')
    @ApiOperation({ summary: 'حذف ارتباط دسته‌بندی و مشخصه فنی' })
    @ApiResponse({ status: 200, description: 'ارتباط حذف شد' })
    @ApiResponse({ status: 404, description: 'ارتباط پیدا نشد' })
    async remove(
        @CurrentUser() user: any,
        @Param('categoryId') categoryId: string,
        @Param('specId') specId: string,
        @LanguageHeader() language: Language
    ) {
        return this.categorySpecsService.remove(categoryId, specId, language);
    }
}