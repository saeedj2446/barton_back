import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateIndustryBranchDto } from './dto/create-industry-branch.dto';
import { UpdateIndustryBranchDto } from './dto/update-industry-branch.dto';
import { IndustryBranchQueryDto } from './dto/industry-branch-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { IndustryBranchService } from "./industry-branch.service";
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Industry Branches (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/industry-branches')
export class IndustryBranchAdminController {
    constructor(private readonly industryBranchService: IndustryBranchService) {}

    @Post()
    @ApiOperation({ summary: 'Create industry branch (Admin only)' })
    @ApiResponse({ status: 201, description: 'Industry branch created successfully' })
    create(
        @Body() createIndustryBranchDto: CreateIndustryBranchDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.create({ ...createIndustryBranchDto, language });
    }

    @Get()
    @ApiOperation({ summary: 'Get all industry branches with pagination (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry branches retrieved successfully' })
    findAll(
        @Query() query: IndustryBranchQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.findAll({ ...query, language });
    }

    @Get('tree')
    @ApiOperation({ summary: 'Get industry branch tree (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry branch tree retrieved successfully' })
    getTree(
        @Query('parentId') parentId: string = null,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.getBranchTree(parentId, language);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get industry branches statistics (Admin only)' })
    @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
    getStats(@LanguageHeader() language: Language) {
        return this.industryBranchService.getBranchStats(language);
    }

    @Get('level/:level')
    @ApiOperation({ summary: 'Get industry branches by level (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry branches retrieved successfully' })
    getByLevel(
        @Param('level') level: number,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.getBranchesByLevel(level, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get industry branch by ID (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry branch retrieved successfully' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.findById(id, language);
    }

    @Get('code/:code')
    @ApiOperation({ summary: 'Get industry branch by code (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry branch retrieved successfully' })
    findByCode(
        @Param('code') code: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.findByCode(code, language);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update industry branch (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry branch updated successfully' })
    update(
        @Param('id') id: string,
        @Body() updateIndustryBranchDto: UpdateIndustryBranchDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.update(id, updateIndustryBranchDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete industry branch (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry branch deleted successfully' })
    remove(@Param('id') id: string) {
        return this.industryBranchService.remove(id);
    }
}