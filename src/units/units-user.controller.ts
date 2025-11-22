// src/units/units-user.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('User - Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/units')
export class UnitsUserController {
    constructor(private readonly unitsService: UnitsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام واحدهای اندازه‌گیری' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'isBase', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
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
    @ApiOperation({ summary: 'دریافت واحد اندازه‌گیری بر اساس ID' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.unitsService.findOne(id, language);
    }

    @Get('key/:key')
    @ApiOperation({ summary: 'دریافت واحد اندازه‌گیری بر اساس کلید' })
    async findByKey(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('key') key: string
    ) {
        return this.unitsService.findByKey(key, language);
    }
}