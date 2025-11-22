// src/locations/locations-admin.controller.ts
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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';
import { CreateLocationContentDto, UpdateLocationContentDto } from './dto/location-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, LocationType, Language } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Admin - Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
@Controller('admin/locations')
export class LocationsAdminController {
    constructor(private readonly locationsService: LocationsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد موقعیت جغرافیایی جدید' })
    @ApiResponse({ status: 201, description: 'موقعیت جغرافیایی ایجاد شد' })
    @ApiResponse({ status: 409, description: 'موقعیت جغرافیایی با این کد وجود دارد' })
    async create(
        @CurrentUser() user: any,
        @Body() createLocationDto: CreateLocationDto,
        @LanguageHeader() language: Language
    ) {
        return this.locationsService.create(createLocationDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام موقعیت‌های جغرافیایی (ادمین)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'type', required: false, enum: LocationType })
    @ApiQuery({ name: 'parent_id', required: false })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'موقعیت‌های جغرافیایی دریافت شد' })
    async findAll(
        @CurrentUser() user: any,
        @Query() query: LocationQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.locationsService.findAll(query, language);
    }

    @Get('tree')
    @ApiOperation({ summary: 'دریافت درخت موقعیت‌های جغرافیایی (ادمین)' })
    @ApiQuery({ name: 'parent_id', required: false, type: String })
    @ApiResponse({ status: 200, description: 'درخت موقعیت‌های جغرافیایی دریافت شد' })
    async getLocationTree(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('parent_id') parentId?: string,

    ) {
        return this.locationsService.getLocationTree(parentId || null, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت موقعیت جغرافیایی بر اساس ID (ادمین)' })
    @ApiResponse({ status: 200, description: 'موقعیت جغرافیایی دریافت شد' })
    @ApiResponse({ status: 404, description: 'موقعیت جغرافیایی پیدا نشد' })
    async findOne(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.locationsService.findOne(id, language);
    }

    @Get('code/:code')
    @ApiOperation({ summary: 'دریافت موقعیت جغرافیایی بر اساس کد (ادمین)' })
    @ApiResponse({ status: 200, description: 'موقعیت جغرافیایی دریافت شد' })
    @ApiResponse({ status: 404, description: 'موقعیت جغرافیایی پیدا نشد' })
    async findByCode(
        @CurrentUser() user: any,
        @Param('code') code: string,
        @LanguageHeader() language: Language
    ) {
        return this.locationsService.findByCode(code, language);
    }

    @Get('type/:type')
    @ApiOperation({ summary: 'دریافت موقعیت‌های جغرافیایی بر اساس نوع (ادمین)' })
    async getByType(
        @CurrentUser() user: any,
        @Param('type') type: LocationType,
        @LanguageHeader() language: Language
    ) {
        return this.locationsService.getByType(type, language);
    }

    @Put(':id')
    @ApiOperation({ summary: 'آپدیت موقعیت جغرافیایی' })
    @ApiResponse({ status: 200, description: 'موقعیت جغرافیایی آپدیت شد' })
    @ApiResponse({ status: 404, description: 'موقعیت جغرافیایی پیدا نشد' })
    @ApiResponse({ status: 409, description: 'موقعیت جغرافیایی با این کد وجود دارد' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateLocationDto: UpdateLocationDto,
        @LanguageHeader() language: Language
    ) {
        return this.locationsService.update(id, updateLocationDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف موقعیت جغرافیایی' })
    @ApiResponse({ status: 200, description: 'موقعیت جغرافیایی حذف شد' })
    @ApiResponse({ status: 404, description: 'موقعیت جغرافیایی پیدا نشد' })
    @ApiResponse({ status: 409, description: 'امکان حذف وجود ندارد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.locationsService.remove(id);
    }

    @Post(':id/contents')
    @ApiOperation({ summary: 'افزودن محتوای چندزبانه به موقعیت جغرافیایی' })
    @ApiResponse({ status: 201, description: 'محتوای چندزبانه اضافه شد' })
    async addContent(
        @Param('id') id: string,
        @Body() contentDto: CreateLocationContentDto
    ) {
        return this.locationsService.createLocationContent(id, contentDto);
    }

    @Put(':id/contents/:language')
    @ApiOperation({ summary: 'آپدیت محتوای چندزبانه موقعیت جغرافیایی' })
    @ApiResponse({ status: 200, description: 'محتوای چندزبانه آپدیت شد' })
    async updateContent(
        @Param('id') id: string,
        @Param('language') language: Language,
        @Body() contentDto: UpdateLocationContentDto
    ) {
        return this.locationsService.updateLocationContent(id, language, contentDto);
    }

    @Get(':id/contents')
    @ApiOperation({ summary: 'دریافت تمام محتوای چندزبانه موقعیت جغرافیایی' })
    @ApiResponse({ status: 200, description: 'محتوای چندزبانه دریافت شد' })
    async getContents(@Param('id') id: string) {
        return this.locationsService.getLocationTranslations(id);
    }

    @Get('children')
    @ApiOperation({ summary: 'دریافت فرزندان یک موقعیت جغرافیایی (ادمین)' })
    @ApiQuery({ name: 'parentId', required: false })
    async getChildren(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('parentId') parentId?: string,

    ) {
        return this.locationsService.getChildren(parentId, language);
    }
}