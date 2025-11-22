// src/controllers/product/product-public.controller.ts
import {
    Controller,
    Get,
    Param,
    Query,
    UseInterceptors,
    ClassSerializerInterceptor
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam
} from '@nestjs/swagger';

import { Language, SellUnit } from '@prisma/client';
import {ProductPublicService} from "./service/product.public.service";
import { Public } from "../common/decorators/public.decorator";
import {LanguageHeader} from "../common/decorators/language.decorator";

@ApiTags('Public - Products')
@Controller('public/products')
@UseInterceptors(ClassSerializerInterceptor)
export class ProductPublicController {
    constructor(private readonly productPublicService: ProductPublicService) {}

    @Get()
    @Public()
    @ApiOperation({
        summary: 'جستجوی محصولات فعال',
        description: 'دریافت لیست محصولات فعال با فیلترهای مختلف'
    })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'شماره صفحه' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد در هر صفحه' })
    @ApiQuery({ name: 'category_id', required: false, type: String, description: 'شناسه دسته‌بندی' })
    @ApiQuery({ name: 'sub_category_id', required: false, type: String, description: 'شناسه زیردسته‌بندی' })
    @ApiQuery({ name: 'location_level_1_id', required: false, type: String, description: 'شناسه کشور' })
    @ApiQuery({ name: 'location_level_2_id', required: false, type: String, description: 'شناسه استان' })
    @ApiQuery({ name: 'location_level_3_id', required: false, type: String, description: 'شناسه شهر' })
    @ApiQuery({ name: 'min_price', required: false, type: Number, description: 'حداقل قیمت' })
    @ApiQuery({ name: 'max_price', required: false, type: Number, description: 'حداکثر قیمت' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'جستجوی متنی' })
    @ApiQuery({ name: 'sort_by', required: false, enum: ['newest', 'price_low', 'price_high', 'popular', 'most_liked'], description: 'مرتب‌سازی' })
    @ApiResponse({ status: 200, description: 'لیست محصولات' })
    async getActiveProducts(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('category_id') category_id?: string,
        @Query('sub_category_id') sub_category_id?: string,
        @Query('location_level_1_id') location_level_1_id?: string,
        @Query('location_level_2_id') location_level_2_id?: string,
        @Query('location_level_3_id') location_level_3_id?: string,
        @Query('min_price') min_price?: number,
        @Query('max_price') max_price?: number,
        @Query('search') search?: string,
        @Query('sort_by') sort_by?: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.getActiveProducts({
            page,
            limit,
            category_id,
            sub_category_id,
            location_level_1_id,
            location_level_2_id,
            location_level_3_id,
            min_price,
            max_price,
            search,
            sort_by,
            language
        });
    }

    @Get('featured')
    @Public()
    @ApiOperation({
        summary: 'دریافت محصولات ویژه',
        description: 'دریافت محصولات ویژه و بوست شده'
    })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد محصولات' })
    @ApiResponse({ status: 200, description: 'لیست محصولات ویژه' })
    async getFeaturedProducts(
        @Query('limit') limit: number = 8,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.getFeaturedProducts(limit, language);
    }

    @Get('popular')
    @Public()
    @ApiOperation({
        summary: 'دریافت محصولات پرطرفدار',
        description: 'دریافت محصولات پرطرفدار بر اساس تعاملات کاربران'
    })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد محصولات' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'بازه زمانی (روز)' })
    @ApiResponse({ status: 200, description: 'لیست محصولات پرطرفدار' })
    async getPopularProducts(
        @Query('limit') limit: number = 10,
        @Query('days') days: number = 7,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.getPopularProducts(limit, days, language);
    }

    @Get('new')
    @Public()
    @ApiOperation({
        summary: 'دریافت محصولات جدید',
        description: 'دریافت جدیدترین محصولات اضافه شده'
    })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد محصولات' })
    @ApiResponse({ status: 200, description: 'لیست محصولات جدید' })
    async getNewProducts(
        @Query('limit') limit: number = 12,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.getNewProducts(limit, language);
    }

    @Get(':id')
    @Public()
    @ApiOperation({
        summary: 'دریافت جزئیات محصول',
        description: 'دریافت اطلاعات کامل یک محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiQuery({ name: 'track_view', required: false, type: Boolean, description: 'ردیابی بازدید' })
    @ApiResponse({ status: 200, description: 'جزئیات محصول' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async getProductDetail(
        @Param('id') id: string,
        @Query('track_view') track_view: boolean = true,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.getProductDetail(id, language, track_view);
    }

    @Get(':id/similar')
    @Public()
    @ApiOperation({
        summary: 'دریافت محصولات مشابه',
        description: 'دریافت محصولات مشابه بر اساس دسته‌بندی و ویژگی‌ها'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد محصولات' })
    @ApiResponse({ status: 200, description: 'لیست محصولات مشابه' })
    async getSimilarProducts(
        @Param('id') id: string,
        @Query('limit') limit: number = 6,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.getSimilarProducts(id, limit, language);
    }

    @Get('category/:categoryId')
    @Public()
    @ApiOperation({
        summary: 'دریافت محصولات بر اساس دسته‌بندی',
        description: 'دریافت محصولات یک دسته‌بندی خاص'
    })
    @ApiParam({ name: 'categoryId', description: 'شناسه دسته‌بندی', type: String })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'شماره صفحه' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد در هر صفحه' })
    @ApiQuery({ name: 'sort_by', required: false, enum: ['newest', 'price_low', 'price_high', 'popular'], description: 'مرتب‌سازی' })
    @ApiResponse({ status: 200, description: 'لیست محصولات دسته‌بندی' })
    async getProductsByCategory(
        @Param('categoryId') categoryId: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 12,
        @Query('sort_by') sort_by: string = 'popular',
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.getProductsByCategory(categoryId, {
            page,
            limit,
            sort_by,
            language
        });
    }

    @Get('search/advanced')
    @Public()
    @ApiOperation({
        summary: 'جستجوی پیشرفته محصولات',
        description: 'جستجوی پیشرفته با فیلترهای مختلف'
    })
    @ApiQuery({ name: 'query', required: false, type: String, description: 'عبارت جستجو' })
    @ApiQuery({ name: 'category_id', required: false, type: String, description: 'شناسه دسته‌بندی' })
    @ApiQuery({ name: 'sub_category_id', required: false, type: String, description: 'شناسه زیردسته‌بندی' })
    @ApiQuery({ name: 'min_price', required: false, type: Number, description: 'حداقل قیمت' })
    @ApiQuery({ name: 'max_price', required: false, type: Number, description: 'حداکثر قیمت' })
    @ApiQuery({ name: 'min_stock', required: false, type: Number, description: 'حداقل موجودی' })
    @ApiQuery({ name: 'unit', required: false, enum: SellUnit, description: 'واحد فروش' })
    @ApiQuery({ name: 'has_video', required: false, type: Boolean, description: 'دارای ویدئو' })
    @ApiQuery({ name: 'brand_name', required: false, type: String, description: 'نام برند' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'شماره صفحه' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد در هر صفحه' })
    @ApiQuery({ name: 'sort_by', required: false, enum: ['relevance', 'newest', 'price_low', 'price_high', 'popular'], description: 'مرتب‌سازی' })
    @ApiResponse({ status: 200, description: 'نتایج جستجو' })
    async searchProductsAdvanced(
        @Query('query') query?: string,
        @Query('category_id') category_id?: string,
        @Query('sub_category_id') sub_category_id?: string,
        @Query('min_price') min_price?: number,
        @Query('max_price') max_price?: number,
        @Query('min_stock') min_stock?: number,
        @Query('unit') unit?: SellUnit,
        @Query('has_video') has_video?: boolean,
        @Query('brand_name') brand_name?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 12,
        @Query('sort_by') sort_by: string = 'relevance',
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPublicService.searchProductsAdvanced({
            query,
            category_id,
            sub_category_id,
            min_price,
            max_price,
            min_stock,
            unit,
            has_video,
            brand_name,
            sort_by,
            page,
            limit,
            language
        });
    }
}