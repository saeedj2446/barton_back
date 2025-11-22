import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IndustryRelationService } from './industry-relation.service';
import { Language } from '@prisma/client';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Industry Relations')
@Controller('industry-relations')
export class IndustryRelationControllerPublic {
    constructor(private readonly industryRelationService: IndustryRelationService) {}

    @Get('industry/:industryId')
    @ApiOperation({ summary: 'Get industry relations by industry ID (Public)' })
    @ApiResponse({ status: 200, description: 'Industry relations retrieved successfully' })
    getIndustryRelations(
        @Param('industryId') industryId: string,
        @Query('type') type: 'supplier' | 'customer' | 'both' = 'both',
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.getIndustryRelations(industryId, type, language);
    }

    @Get('industry/:industryId/related')
    @ApiOperation({ summary: 'Get related industries (Public)' })
    @ApiResponse({ status: 200, description: 'Related industries retrieved successfully' })
    getRelatedIndustries(
        @Param('industryId') industryId: string,
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.industryRelationService.findRelatedIndustries(industryId, limit, language);
    }
}