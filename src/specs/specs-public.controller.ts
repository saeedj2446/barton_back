// src/specs/specs-public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SpecsService } from './specs.service';
import { Public } from '../common/decorators/public.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('Public - Specs')
@Public()
@Controller('public/specs')
export class SpecsPublicController {
    constructor(private readonly specsService: SpecsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام مشخصه‌های فنی (عمومی)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'type', required: false })
    @ApiQuery({ name: 'is_filterable', required: false, type: Boolean })
    @ApiQuery({ name: 'is_required', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @Query('search') search?: string,
        @Query('type') type?: string,
        @Query('is_filterable') is_filterable?: boolean,
        @Query('is_required') is_required?: boolean,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            search,
            type,
            is_filterable: is_filterable === undefined ? undefined : Boolean(is_filterable),
            is_required: is_required === undefined ? undefined : Boolean(is_required),
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.specsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت مشخصه فنی بر اساس ID (عمومی)' })
    async findOne(
        @LanguageHeader() language: Language,
        @Param('id') id: string
    ) {
        return this.specsService.findOne(id, language);
    }

    @Get('key/:key')
    @ApiOperation({ summary: 'دریافت مشخصه فنی بر اساس کلید (عمومی)' })
    async findByKey(
        @LanguageHeader() language: Language,
        @Param('key') key: string
    ) {
        return this.specsService.findByKey(key, language);
    }
}