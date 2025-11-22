import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IndustryService } from './industry.service';
import { CreateIndustryDto } from './dto/create-industry.dto';
import { UpdateIndustryDto } from './dto/update-industry.dto';
import { IndustryQueryDto } from './dto/industry-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Industries (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/industries')
export class IndustryAdminController {
    constructor(private readonly industryService: IndustryService) {}

    @Post()
    @ApiOperation({ summary: 'Create industry (Admin only)' })
    @ApiResponse({ status: 201, description: 'Industry created successfully' })
    create(
        @Body() createIndustryDto: CreateIndustryDto
    ) {
        // language از داخل DTO خوانده می‌شود، نیازی به ارسال جداگانه نیست
        return this.industryService.create(createIndustryDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all industries with pagination and filters (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industries retrieved successfully' })
    findAll(
        @Query() query: IndustryQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.findAll({ ...query, language });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get industries statistics (Admin only)' })
    @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
    getStats(@LanguageHeader() language: Language) {
        return this.industryService.getIndustryStats(language);
    }

    @Get('tree')
    @ApiOperation({ summary: 'Get industry tree (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry tree retrieved successfully' })
    getTree(
        @Query('parentId') parentId: string = null,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getIndustryTree(parentId, language);
    }

    @Get('popular')
    @ApiOperation({ summary: 'Get popular industries (Admin only)' })
    @ApiResponse({ status: 200, description: 'Popular industries retrieved successfully' })
    getPopular(
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getPopularIndustries(limit, language);
    }

    @Get('search')
    @ApiOperation({ summary: 'Search industries (Admin only)' })
    @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
    search(
        @Query('q') query: string,
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.searchIndustries(query, limit, language);
    }

    @Get('branch/:branchId')
    @ApiOperation({ summary: 'Get industries by branch (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industries retrieved successfully' })
    getByBranch(
        @Param('branchId') branchId: string,
        @Query() query: IndustryQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getIndustriesByBranch(branchId, query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get industry by ID (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry retrieved successfully' })
    findOne(
        @Param('id') id: string,
        @Query('includeRelations') includeRelations: boolean = false,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.findById(id, includeRelations, language);
    }

    @Get('business-number/:businessNumber')
    @ApiOperation({ summary: 'Get industry by business number (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry retrieved successfully' })
    findByBusinessNumber(
        @Param('businessNumber') businessNumber: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.findByBusinessNumber(businessNumber, language);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update industry (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry updated successfully' })
    update(
        @Param('id') id: string,
        @Body() updateIndustryDto: UpdateIndustryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.update(id, updateIndustryDto, language);
    }

    @Patch(':id/toggle-status')
    @ApiOperation({ summary: 'Toggle industry active status (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry status updated successfully' })
    toggleStatus(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.toggleStatus(id, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete industry (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry deleted successfully' })
    remove(@Param('id') id: string) {
        return this.industryService.remove(id);
    }
}