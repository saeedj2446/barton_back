import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IndustryRelationService } from './industry-relation.service';
import { CreateIndustryRelationDto } from './dto/create-industry-relation.dto';
import { UpdateIndustryRelationDto } from './dto/update-industry-relation.dto';
import { IndustryRelationQueryDto } from './dto/industry-relation-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Industry Relations (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/industry-relations')
export class IndustryRelationAdminController {
    constructor(private readonly industryRelationService: IndustryRelationService) {}

    @Post()
    @ApiOperation({ summary: 'Create industry relation (Admin only)' })
    @ApiResponse({ status: 201, description: 'Industry relation created successfully' })
    create(
        @Body() createIndustryRelationDto: CreateIndustryRelationDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.create(createIndustryRelationDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'Get all industry relations with pagination and filters (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry relations retrieved successfully' })
    findAll(
        @Query() query: IndustryRelationQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.findAll({ ...query, language }, language);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get industry relations statistics (Admin only)' })
    @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
    getStats(@LanguageHeader() language: Language) {
        return this.industryRelationService.getRelationStats(language);
    }

    @Get('industry/:industryId')
    @ApiOperation({ summary: 'Get industry relations by industry ID (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry relations retrieved successfully' })
    getIndustryRelations(
        @Param('industryId') industryId: string,
        @Query('type') type: 'supplier' | 'customer' | 'both' = 'both',
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.getIndustryRelations(industryId, type, language);
    }

    @Get('industry/:industryId/related')
    @ApiOperation({ summary: 'Get related industries (Admin only)' })
    @ApiResponse({ status: 200, description: 'Related industries retrieved successfully' })
    getRelatedIndustries(
        @Param('industryId') industryId: string,
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.findRelatedIndustries(industryId, limit, language);
    }

    @Get('industry/:industryId/suggestions')
    @ApiOperation({ summary: 'Get relation suggestions for industry (Admin only)' })
    @ApiResponse({ status: 200, description: 'Relation suggestions retrieved successfully' })
    getRelationSuggestions(
        @Param('industryId') industryId: string,
        @Query('limit') limit: number = 5,
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.suggestRelations(industryId, limit, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get industry relation by ID (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry relation retrieved successfully' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.findById(id, language);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update industry relation (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry relation updated successfully' })
    update(
        @Param('id') id: string,
        @Body() updateIndustryRelationDto: UpdateIndustryRelationDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.update(id, updateIndustryRelationDto, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete industry relation (Admin only)' })
    @ApiResponse({ status: 200, description: 'Industry relation deleted successfully' })
    remove(@Param('id') id: string) {
        return this.industryRelationService.remove(id);
    }
}