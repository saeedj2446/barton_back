// src/units/units-public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { Public } from '../common/decorators/public.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('Public - Units')
@Public()
@Controller('public/units')
export class UnitsPublicController {
    constructor(private readonly unitsService: UnitsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام واحدهای اندازه‌گیری (عمومی)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'isBase', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @Query('search') search?: string,
        @Query('isBase') isBase?: boolean,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            search,
            isBase: isBase === undefined ? undefined : Boolean(isBase),
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.unitsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت واحد اندازه‌گیری بر اساس ID (عمومی)' })
    async findOne(
        @LanguageHeader() language: Language,
        @Param('id') id: string
    ) {
        return this.unitsService.findOne(id, language);
    }

    @Get('key/:key')
    @ApiOperation({ summary: 'دریافت واحد اندازه‌گیری بر اساس کلید (عمومی)' })
    async findByKey(
        @LanguageHeader() language: Language,
        @Param('key') key: string
    ) {
        return this.unitsService.findByKey(key, language);
    }
}