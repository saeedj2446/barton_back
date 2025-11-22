// src/specs/specs-user.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SpecsService } from './specs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Language } from '@prisma/client';

@ApiTags('User - Specs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/specs')
export class SpecsUserController {
    constructor(private readonly specsService: SpecsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام مشخصه‌های فنی' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'type', required: false })
    @ApiQuery({ name: 'is_filterable', required: false, type: Boolean })
    @ApiQuery({ name: 'is_required', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
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
    @ApiOperation({ summary: 'دریافت مشخصه فنی بر اساس ID' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.specsService.findOne(id, language);
    }

    @Get('key/:key')
    @ApiOperation({ summary: 'دریافت مشخصه فنی بر اساس کلید' })
    async findByKey(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('key') key: string
    ) {
        return this.specsService.findByKey(key, language);
    }
}