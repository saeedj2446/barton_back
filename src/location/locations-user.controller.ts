// src/locations/locations-user.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { LocationType, Language } from '@prisma/client';

@ApiTags('User - Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/locations')
export class LocationsUserController {
    constructor(private readonly locationsService: LocationsService) {}

    @Get('tree')
    @ApiOperation({ summary: 'دریافت درخت موقعیت‌های جغرافیایی' })
    @ApiQuery({ name: 'parent_id', required: false, type: String })
    async getLocationTree(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('parent_id') parentId?: string
    ) {
        return this.locationsService.getLocationTree(parentId || null, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام موقعیت‌های جغرافیایی' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'type', required: false, enum: LocationType })
    @ApiQuery({ name: 'parent_id', required: false })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('search') search?: string,
        @Query('type') type?: LocationType,
        @Query('parent_id') parentId?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            search,
            type,
            parent_id: parentId,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.locationsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت موقعیت جغرافیایی بر اساس ID' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.locationsService.findOne(id, language);
    }

    @Get('code/:code')
    @ApiOperation({ summary: 'دریافت موقعیت جغرافیایی بر اساس کد' })
    async findByCode(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('code') code: string
    ) {
        return this.locationsService.findByCode(code, language);
    }

    @Get('type/:type')
    @ApiOperation({ summary: 'دریافت موقعیت‌های جغرافیایی بر اساس نوع' })
    async getByType(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('type') type: LocationType
    ) {
        return this.locationsService.getByType(type, language);
    }

    @Get('children')
    @ApiOperation({ summary: 'دریافت فرزندان یک موقعیت جغرافیایی' })
    @ApiQuery({ name: 'parentId', required: false })
    async getChildren(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('parentId') parentId?: string
    ) {
        return this.locationsService.getChildren(parentId, language);
    }

    @Get(':id/contents')
    @ApiOperation({ summary: 'دریافت تمام محتوای چندزبانه موقعیت جغرافیایی' })
    async getLocationContents(@Param('id') id: string) {
        return this.locationsService.getLocationTranslations(id);
    }
}