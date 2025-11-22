import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IndustryBranchService } from './industry-branch.service';
import { IndustryBranchQueryDto } from './dto/industry-branch-query.dto';
import { Language } from '@prisma/client';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Industry Branches')
@Controller('industry-branches')
export class IndustryBranchControllerPublic {
    constructor(private readonly industryBranchService: IndustryBranchService) {}

    @Get()
    @ApiOperation({ summary: 'Get all industry branches (Public)' })
    @ApiResponse({ status: 200, description: 'Industry branches retrieved successfully' })
    findAll(
        @Query() query: IndustryBranchQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.getPublicBranches({ ...query, language });
    }

    @Get('tree')
    @ApiOperation({ summary: 'Get industry branch tree (Public)' })
    @ApiResponse({ status: 200, description: 'Industry branch tree retrieved successfully' })
    getTree(@LanguageHeader() language: Language) {
        return this.industryBranchService.getPublicBranchTree(language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get industry branch by ID (Public)' })
    @ApiResponse({ status: 200, description: 'Industry branch retrieved successfully' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.findById(id, language);
    }

    @Get('code/:code')
    @ApiOperation({ summary: 'Get industry branch by code (Public)' })
    @ApiResponse({ status: 200, description: 'Industry branch retrieved successfully' })
    findByCode(
        @Param('code') code: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryBranchService.findByCode(code, language);
    }
}