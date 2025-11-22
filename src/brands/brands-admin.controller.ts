// src/brands/brands-admin.controller.ts
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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandQueryDto } from './dto/brand-query.dto';
import { CreateBrandContentDto } from './dto/create-brand.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Admin - Brands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
@Controller('admin/brands')
export class BrandsAdminController {
    constructor(private readonly brandsService: BrandsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد برند جدید' })
    @ApiResponse({ status: 201, description: 'برند ایجاد شد' })
    @ApiResponse({ status: 409, description: 'برند با این نام وجود دارد' })
    async create(
        @CurrentUser() user: any,
        @Body() createBrandDto: CreateBrandDto,
        @LanguageHeader() language: Language
    ) {
        return this.brandsService.create(createBrandDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام برندها (ادمین)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'brand_type', required: false })
    @ApiQuery({ name: 'manufacturer_type', required: false })
    @ApiQuery({ name: 'industry_id', required: false })
    @ApiQuery({ name: 'is_verified', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'برندها دریافت شد' })
    async findAll(
        @CurrentUser() user: any,
        @Query() query: BrandQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.brandsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت برند بر اساس ID (ادمین)' })
    @ApiResponse({ status: 200, description: 'برند دریافت شد' })
    @ApiResponse({ status: 404, description: 'برند پیدا نشد' })
    async findOne(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.brandsService.findOne(id, language);
    }

    @Put(':id')
    @ApiOperation({ summary: 'آپدیت برند' })
    @ApiResponse({ status: 200, description: 'برند آپدیت شد' })
    @ApiResponse({ status: 404, description: 'برند پیدا نشد' })
    @ApiResponse({ status: 409, description: 'برند با این نام وجود دارد' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateBrandDto: UpdateBrandDto,
        @LanguageHeader() language: Language
    ) {
        return this.brandsService.update(id, updateBrandDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف برند' })
    @ApiResponse({ status: 200, description: 'برند حذف شد' })
    @ApiResponse({ status: 404, description: 'برند پیدا نشد' })
    @ApiResponse({ status: 409, description: 'امکان حذف وجود ندارد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.brandsService.remove(id, language);
    }

    @Post(':id/contents')
    @ApiOperation({ summary: 'افزودن محتوای چندزبانه به برند' })
    @ApiResponse({ status: 201, description: 'محتوای چندزبانه اضافه شد' })
    async addContent(
        @Param('id') id: string,
        @Body() contentDto: CreateBrandContentDto,
        @LanguageHeader() language: Language
    ) {
        return this.brandsService.createBrandContent(id, contentDto, language);
    }

    @Get(':id/contents')
    @ApiOperation({ summary: 'دریافت تمام محتوای چندزبانه برند' })
    @ApiResponse({ status: 200, description: 'محتوای چندزبانه دریافت شد' })
    async getContents(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.brandsService.getBrandTranslations(id, language);
    }
}