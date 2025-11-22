// src/brands/brands-user.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import { BrandType, ManufacturerType, Language } from '@prisma/client';

@ApiTags('User - Brands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/brands')
export class BrandsUserController {
    constructor(private readonly brandsService: BrandsService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام برندها' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'brand_type', required: false, enum: BrandType })
    @ApiQuery({ name: 'manufacturer_type', required: false, enum: ManufacturerType })
    @ApiQuery({ name: 'industry_id', required: false })
    @ApiQuery({ name: 'is_verified', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('search') search?: string,
        @Query('brand_type') brand_type?: BrandType,
        @Query('manufacturer_type') manufacturer_type?: ManufacturerType,
        @Query('industry_id') industry_id?: string,
        @Query('is_verified') is_verified?: boolean,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ) {
        const query = {
            search,
            brand_type,
            manufacturer_type,
            industry_id,
            is_verified: is_verified === undefined ? undefined : Boolean(is_verified),
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50
        };

        return this.brandsService.findAll(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت برند بر اساس ID' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.brandsService.findOne(id, language);
    }

    @Get(':id/contents')
    @ApiOperation({ summary: 'دریافت تمام محتوای چندزبانه برند' })
    async getContents(@Param('id') id: string) {
        return this.brandsService.getBrandTranslations(id);
    }
}