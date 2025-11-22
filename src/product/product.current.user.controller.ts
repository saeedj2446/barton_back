// src/controllers/product/product-current-user.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    UseInterceptors,
    ClassSerializerInterceptor,
    HttpStatus,
    HttpCode
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam
} from '@nestjs/swagger';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Language, SystemRole, SellUnit, FileUsage } from '@prisma/client';
import {ProductPricesssssssService} from "./service/product.pricesssssss.service";
import {ProductBaseService} from "./service/product.base.service";
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {RolesGuard} from "../common/guards/roles.guard";
import {Roles} from "../common/decorators/roles.decorator";
import {CurrentUser} from "../common/decorators/current-user.decorator";
import {LanguageHeader} from "../common/decorators/language.decorator";

@ApiTags('Current User - Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('user/products')
export class ProductCurrentUserController {
    constructor(
        private readonly productBaseService: ProductBaseService,
        private readonly ProductPricesssssssService: ProductPricesssssssService,
    ) {}

    @Post()
    @ApiOperation({
        summary: 'ایجاد محصول جدید',
        description: 'ایجاد یک محصول جدید توسط کاربر'
    })
    @ApiResponse({ status: 201, description: 'محصول ایجاد شد' })
    @ApiResponse({ status: 400, description: 'داده‌های نامعتبر' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    async createProduct(
        @CurrentUser() user: any,
        @Body() createProductDto: CreateProductDto,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productBaseService.createProduct({
            ...createProductDto,
            user_id: user.id,
            contents: createProductDto.contents || [{
                language,
                name: createProductDto.name || 'محصول جدید',
                description: 'توضیحات محصول',
                auto_translated: false
            }]
        });
    }

    @Get()
    @ApiOperation({
        summary: 'دریافت محصولات کاربر',
        description: 'دریافت لیست محصولات کاربر جاری'
    })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'شماره صفحه' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد در هر صفحه' })
    @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], description: 'فیلتر وضعیت' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'جستجوی متنی' })
    @ApiQuery({ name: 'sort_by', required: false, enum: ['newest', 'oldest', 'price_low', 'price_high'], description: 'مرتب‌سازی' })
    @ApiResponse({ status: 200, description: 'لیست محصولات کاربر' })
    async getUserProducts(
        @CurrentUser() user: any,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('sort_by') sort_by?: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productBaseService.searchProducts({
            page,
            limit,
            status: status as any,
            search,
            sort_by,
            user_id: user.id,
            language
        });
    }

    @Get(':id')
    @ApiOperation({
        summary: 'دریافت جزئیات محصول کاربر',
        description: 'دریافت اطلاعات کامل یک محصول متعلق به کاربر'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'جزئیات محصول' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async getUserProduct(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productBaseService.getProductById(id, language);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'بروزرسانی محصول',
        description: 'بروزرسانی اطلاعات یک محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'محصول بروزرسانی شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    async updateProduct(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateProductDto: UpdateProductDto,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productBaseService.updateProduct(id, updateProductDto, user.id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'حذف محصول',
        description: 'حذف یک محصول (غیرفعال کردن)'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 204, description: 'محصول حذف شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    async deleteProduct(
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.productBaseService.deleteProduct(id, user.id);
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: 'دریافت آمار محصول',
        description: 'دریافت آمار و آنالیتیکس یک محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'آمار محصول' })
    async getProductStats(
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.productBaseService.getProductStats(id);
    }

    @Get(':id/related')
    @ApiOperation({
        summary: 'دریافت محصولات مرتبط',
        description: 'دریافت محصولات مرتبط با محصول جاری'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد محصولات' })
    @ApiResponse({ status: 200, description: 'لیست محصولات مرتبط' })
    async getRelatedProducts(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Query('limit') limit: number = 8,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productBaseService.getRelatedProducts(id, limit, language);
    }

    // ==================== مدیریت قیمت‌ها ====================

    @Post(':id/prices')
    @ApiOperation({
        summary: 'ایجاد استراتژی قیمت',
        description: 'ایجاد استراتژی قیمت جدید برای محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 201, description: 'استراتژی قیمت ایجاد شد' })
    async createPriceStrategy(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() createPriceDto: any,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.ProductPricesssssssService.createPriceStrategy({
            ...createPriceDto,
            product_id: id
        }, user.id, language);
    }

    @Get(':id/prices')
    @ApiOperation({
        summary: 'دریافت استراتژی‌های قیمت',
        description: 'دریافت تمام استراتژی‌های قیمت محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiQuery({ name: 'active_only', required: false, type: Boolean, description: 'فقط استراتژی‌های فعال' })
    @ApiResponse({ status: 200, description: 'لیست استراتژی‌های قیمت' })
    async getPriceStrategies(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Query('active_only') active_only: boolean = true,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.ProductPricesssssssService.getProductPriceStrategies(id, {
            active_only,
            language
        });
    }

    @Post(':id/prices/calculate')
    @ApiOperation({
        summary: 'محاسبه قیمت نهایی',
        description: 'محاسبه قیمت نهایی بر اساس شرایط مختلف'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'قیمت نهایی محاسبه شده' })
    async calculateFinalPrice(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() conditions: any,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.ProductPricesssssssService.calculateFinalPriceForConditions(id, conditions, language);
    }

    // ==================== مدیریت موجودی ====================

    @Patch(':id/stock')
    @ApiOperation({
        summary: 'بروزرسانی موجودی',
        description: 'بروزرسانی موجودی محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'موجودی بروزرسانی شد' })
    async updateStock(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body('stock') stock: number
    ) {
        return this.productBaseService.updateStock(id, stock, user.id);
    }

    // ==================== مدیریت محتوای چندزبانه ====================

    @Patch(':id/content')
    @ApiOperation({
        summary: 'بروزرسانی محتوای چندزبانه',
        description: 'بروزرسانی محتوای چندزبانه محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'محتوای چندزبانه بروزرسانی شد' })
    async updateProductContent(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() contents: any[]
    ) {
        return this.productBaseService.updateProductContent(id, contents, user.id);
    }
}