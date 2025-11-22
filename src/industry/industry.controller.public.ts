import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IndustryService } from './industry.service';
import { IndustryQueryDto } from './dto/industry-query.dto';
import { Language } from '@prisma/client';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { Public } from "../common/decorators/public.decorator";

@ApiTags('Industries')
@Controller('industries')
@Public()
export class IndustryControllerPublic {
    constructor(private readonly industryService: IndustryService) {}

    @Get('fast-search')
    @ApiOperation({ summary: 'Fast search industries (Public)' })
    @ApiQuery({
        name: 'q',
        required: false,
        description: 'عبارت جستجو (اختیاری) - اگر وارد نشود همه صنف‌ها نمایش داده می‌شوند'
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'شماره صفحه'
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'تعداد در هر صفحه'
    })
    @ApiResponse({ status: 200, description: 'Industries retrieved successfully' })
    async fastSearch(
        @Query('q') search?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @LanguageHeader() language: Language = Language.fa
    ) {
        // اگر search وجود ندارد یا خالی است، صفحه اول همه صنف‌ها را برگردان
        if (!search || search.trim() === '') {
            return this.industryService.fastFind('', language, page, limit);
        }

        return this.industryService.fastFind(search.trim(), language, page, limit);
    }

    @Get()
    @ApiOperation({ summary: 'Get all industries (Public)' })
    @ApiResponse({ status: 200, description: 'Industries retrieved successfully' })
    findAll(
        @Query() query: IndustryQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getPublicIndustries({ ...query, language });
    }

    @Get('tree')
    @ApiOperation({ summary: 'Get industry tree (Public)' })
    @ApiResponse({ status: 200, description: 'Industry tree retrieved successfully' })
    getTree(
        @Query('parentId') parentId: string = null,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getIndustryTree(parentId, language);
    }

    @Get('popular')
    @ApiOperation({ summary: 'Get popular industries (Public)' })
    @ApiResponse({ status: 200, description: 'Popular industries retrieved successfully' })
    getPopular(
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getPopularIndustries(limit, language);
    }

    @Get('search')
    @ApiOperation({ summary: 'Search industries (Public)' })
    @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
    search(
        @Query('q') query: string,
        @Query('limit') limit: number = 10,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.searchIndustries(query, limit, language);
    }

    @Get('branch/:branchId')
    @ApiOperation({ summary: 'Get industries by branch (Public)' })
    @ApiResponse({ status: 200, description: 'Industries retrieved successfully' })
    getByBranch(
        @Param('branchId') branchId: string,
        @Query() query: IndustryQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getIndustriesByBranch(branchId, query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get industry by ID (Public)' })
    @ApiResponse({ status: 200, description: 'Industry retrieved successfully' })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.getPublicIndustry(id, language);
    }

    @Get('business-number/:businessNumber')
    @ApiOperation({ summary: 'Get industry by business number (Public)' })
    @ApiResponse({ status: 200, description: 'Industry retrieved successfully' })
    findByBusinessNumber(
        @Param('businessNumber') businessNumber: string,
        @LanguageHeader() language: Language
    ) {
        return this.industryService.findByBusinessNumber(businessNumber, language);
    }
}