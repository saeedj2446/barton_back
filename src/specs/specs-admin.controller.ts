// src/specs/specs-admin.controller.ts
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
import { SpecsService } from './specs.service';
import { CreateSpecDto } from './dto/create-spec.dto';
import { UpdateSpecDto } from './dto/update-spec.dto';
import { SpecQueryDto } from './dto/spec-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Admin - Specs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
@Controller('admin/specs')
export class SpecsAdminController {
    constructor(private readonly specsService: SpecsService) {}

    @Post()
    @ApiOperation({ summary: 'ایجاد مشخصه فنی جدید' })
    @ApiResponse({ status: 201, description: 'مشخصه فنی ایجاد شد' })
    @ApiResponse({ status: 409, description: 'مشخصه فنی با این کلید وجود دارد' })
    async create(
        @CurrentUser() user: any,
        @Body() createSpecDto: CreateSpecDto,
        @LanguageHeader() language: Language
    ) {
        return this.specsService.create(createSpecDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام مشخصه‌های فنی (ادمین)' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'type', required: false })
    @ApiQuery({ name: 'is_filterable', required: false, type: Boolean })
    @ApiQuery({ name: 'is_required', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'مشخصه‌های فنی دریافت شد' })
    async findAll(
        @CurrentUser() user: any,
        @Query() query: SpecQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.specsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت مشخصه فنی بر اساس ID (ادمین)' })
    @ApiResponse({ status: 200, description: 'مشخصه فنی دریافت شد' })
    @ApiResponse({ status: 404, description: 'مشخصه فنی پیدا نشد' })
    async findOne(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.specsService.findOne(id, language);
    }

    @Get('key/:key')
    @ApiOperation({ summary: 'دریافت مشخصه فنی بر اساس کلید (ادمین)' })
    @ApiResponse({ status: 200, description: 'مشخصه فنی دریافت شد' })
    @ApiResponse({ status: 404, description: 'مشخصه فنی پیدا نشد' })
    async findByKey(
        @CurrentUser() user: any,
        @Param('key') key: string,
        @LanguageHeader() language: Language
    ) {
        return this.specsService.findByKey(key, language);
    }

    @Put(':id')
    @ApiOperation({ summary: 'آپدیت مشخصه فنی' })
    @ApiResponse({ status: 200, description: 'مشخصه فنی آپدیت شد' })
    @ApiResponse({ status: 404, description: 'مشخصه فنی پیدا نشد' })
    @ApiResponse({ status: 409, description: 'مشخصه فنی با این کلید وجود دارد' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateSpecDto: UpdateSpecDto,
        @LanguageHeader() language: Language
    ) {
        return this.specsService.update(id, updateSpecDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف مشخصه فنی' })
    @ApiResponse({ status: 200, description: 'مشخصه فنی حذف شد' })
    @ApiResponse({ status: 404, description: 'مشخصه فنی پیدا نشد' })
    @ApiResponse({ status: 409, description: 'امکان حذف وجود ندارد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.specsService.remove(id, language);
    }
}