// src/units/units-admin.controller.ts
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
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Admin - Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
@Controller('admin/units')
export class UnitsAdminController {
    constructor(private readonly unitsService: UnitsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد واحد اندازه‌گیری جدید' })
    @ApiResponse({ status: 201, description: 'واحد ایجاد شد' })
    @ApiResponse({ status: 409, description: 'واحد با این کلید وجود دارد' })
    async create(
        @CurrentUser() user: any,
        @Body() createUnitDto: CreateUnitDto,
        @LanguageHeader() language: Language
    ) {
        return this.unitsService.create(createUnitDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام واحدهای اندازه‌گیری (ادمین)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'isBase', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'واحدها دریافت شد' })
    async findAll(
        @CurrentUser() user: any,
        @Query() query: UnitQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.unitsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت واحد اندازه‌گیری بر اساس ID (ادمین)' })
    @ApiResponse({ status: 200, description: 'واحد دریافت شد' })
    @ApiResponse({ status: 404, description: 'واحد پیدا نشد' })
    async findOne(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.unitsService.findOne(id, language);
    }

    @Get('key/:key')
    @ApiOperation({ summary: 'دریافت واحد اندازه‌گیری بر اساس کلید (ادمین)' })
    @ApiResponse({ status: 200, description: 'واحد دریافت شد' })
    @ApiResponse({ status: 404, description: 'واحد پیدا نشد' })
    async findByKey(
        @CurrentUser() user: any,
        @Param('key') key: string,
        @LanguageHeader() language: Language
    ) {
        return this.unitsService.findByKey(key, language);
    }

    @Put(':id')
    @ApiOperation({ summary: 'آپدیت واحد اندازه‌گیری' })
    @ApiResponse({ status: 200, description: 'واحد آپدیت شد' })
    @ApiResponse({ status: 404, description: 'واحد پیدا نشد' })
    @ApiResponse({ status: 409, description: 'واحد با این کلید وجود دارد' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateUnitDto: UpdateUnitDto,
        @LanguageHeader() language: Language
    ) {
        return this.unitsService.update(id, updateUnitDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف واحد اندازه‌گیری' })
    @ApiResponse({ status: 200, description: 'واحد حذف شد' })
    @ApiResponse({ status: 404, description: 'واحد پیدا نشد' })
    @ApiResponse({ status: 409, description: 'امکان حذف وجود ندارد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.unitsService.remove(id, language);
    }
}