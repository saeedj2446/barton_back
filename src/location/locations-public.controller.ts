// src/locations/locations-public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { Public } from '../common/decorators/public.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { LocationType, Language } from '@prisma/client';

@ApiTags('Public - Locations')
@Public()
@Controller('public/locations')
export class LocationsPublicController {
    constructor(private readonly locationsService: LocationsService) {}

    @Get('tree')
    @ApiOperation({ summary: 'دریافت درخت موقعیت‌های جغرافیایی (عمومی)' })
    @ApiQuery({ name: 'parent_id', required: false, type: String })
    async getLocationTree(
        @LanguageHeader() language: Language,
        @Query('parent_id') parentId?: string
    ) {
        return this.locationsService.getLocationTree(parentId || null, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام موقعیت‌های جغرافیایی (عمومی)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'type', required: false, enum: LocationType })
    @ApiQuery({ name: 'parent_id', required: false })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
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
    @ApiOperation({ summary: 'دریافت موقعیت جغرافیایی بر اساس ID (عمومی)' })
    async findOne(
        @LanguageHeader() language: Language,
        @Param('id') id: string
    ) {
        return this.locationsService.findOne(id, language);
    }

    @Get('code/:code')
    @ApiOperation({ summary: 'دریافت موقعیت جغرافیایی بر اساس کد (عمومی)' })
    async findByCode(
        @LanguageHeader() language: Language,
        @Param('code') code: string
    ) {
        return this.locationsService.findByCode(code, language);
    }

    @Get('type/:type')
    @ApiOperation({ summary: 'دریافت موقعیت‌های جغرافیایی بر اساس نوع (عمومی)' })
    async getByType(
        @LanguageHeader() language: Language,
        @Param('type') type: LocationType
    ) {
        return this.locationsService.getByType(type, language);
    }

    @Get('children')
    @ApiOperation({ summary: 'دریافت فرزندان یک موقعیت جغرافیایی (عمومی)' })
    @ApiQuery({ name: 'parentId', required: false })
    async getChildren(
        @LanguageHeader() language: Language,
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