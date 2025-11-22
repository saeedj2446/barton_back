// src/product-price/product-price.controller.ts
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
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiResponse,
    ApiQuery,
    ApiParam
} from '@nestjs/swagger';
import { ProductPriceService } from './product-price.service';
import { CreateProductPriceDto } from './dto/create-product-price.dto';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';
import { ProductPriceQueryDto } from './dto/product-price-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {SystemRole, Language, PricingConditionType, SellUnit, PricingConditionCategory} from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';

@ApiTags('Product Prices')
@Controller('product-prices')
export class ProductPriceController {
    constructor(private readonly productPriceService: ProductPriceService) {}

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'ایجاد قیمت جدید برای محصول',
        description: 'ایجاد یک قیمت جدید برای محصول. کاربر باید مالک محصول یا دارای نقش مناسب در اکانت باشد.'
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'قیمت با موفقیت ایجاد شد'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'محصول یافت نشد'
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'قیمت تکراری یا دسترسی غیرمجاز'
    })
    create(
        @CurrentUser() user: any,
        @Body() createProductPriceDto: CreateProductPriceDto,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.create(createProductPriceDto, user.id, language);
    }

    @Get('product/:productId')
    @Public()
    @ApiOperation({
        summary: 'دریافت قیمت‌های یک محصول',
        description: 'دریافت تمام قیمت‌های فعال یک محصول. کاربران غیرمالک فقط قیمت‌های فعال را می‌بینند.'
    })
    @ApiParam({
        name: 'productId',
        description: 'شناسه محصول',
        type: String,
        required: true
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'لیست قیمت‌های محصول'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'محصول یافت نشد'
    })
    findByProduct(
        @Param('productId') productId: string,
        @CurrentUser() user?: any,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.findByProduct(productId, user?.id, language);
    }

    @Get('search')
    @Public()
    @ApiOperation({
        summary: 'جستجوی پیشرفته قیمت‌ها',
        description: 'جستجوی قیمت‌ها بر اساس فیلترهای مختلف'
    })
    @ApiQuery({
        name: 'product_id',
        description: 'شناسه محصول',
        required: false,
        type: String
    })
    @ApiQuery({
        name: 'price_unit',
        description: 'واحد قیمت',
        required: false,
        enum: Object.values(SellUnit)
    })
    @ApiQuery({
        name: 'condition_category',
        description: 'دسته شرط قیمت‌گذاری',
        required: false,
        enum: Object.values(PricingConditionCategory)
    })
    @ApiQuery({
        name: 'condition_type',
        description: 'نوع شرط قیمت‌گذاری',
        required: false,
        enum: Object.values(PricingConditionType)
    })
    @ApiQuery({
        name: 'min_price',
        description: 'حداقل قیمت',
        required: false,
        type: Number
    })
    @ApiQuery({
        name: 'max_price',
        description: 'حداکثر قیمت',
        required: false,
        type: Number
    })
    @ApiQuery({
        name: 'has_discount',
        description: 'دارای تخفیف',
        required: false,
        type: Boolean
    })
    @ApiQuery({
        name: 'is_active',
        description: 'فقط قیمت‌های فعال',
        required: false,
        type: Boolean
    })
    @ApiQuery({
        name: 'page',
        description: 'شماره صفحه',
        required: false,
        type: Number
    })
    @ApiQuery({
        name: 'limit',
        description: 'تعداد در هر صفحه',
        required: false,
        type: Number
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'نتایج جستجو'
    })
    search(
        @Query() query: ProductPriceQueryDto,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.search(query, language);
    }

    @Get('filters')
    @Public()
    @ApiOperation({
        summary: 'دریافت فیلترهای موجود برای قیمت‌ها',
        description: 'دریافت لیست فیلترهای قابل استفاده برای جستجوی قیمت‌ها'
    })
    @ApiQuery({
        name: 'product_id',
        description: 'شناسه محصول (اختیاری)',
        required: false,
        type: String
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'فیلترهای موجود'
    })
    getFilters(
        @Query('product_id') productId?: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.getPriceFilters(productId, language);
    }

    @Get('calculate/:productId')
    @Public()
    @ApiOperation({
        summary: 'محاسبه قیمت نهایی بر اساس شرایط',
        description: 'محاسبه قیمت نهایی محصول با اعمال شرایط مختلف مانند تخفیف حجمی، نوع مشتری و ...'
    })
    @ApiParam({
        name: 'productId',
        description: 'شناسه محصول',
        type: String,
        required: true
    })
    @ApiQuery({
        name: 'quantity',
        description: 'تعداد (برای تخفیف حجمی)',
        required: false,
        type: Number
    })
    @ApiQuery({
        name: 'customer_type',
        description: 'نوع مشتری',
        required: false,
        enum: Object.values(PricingConditionType)
    })
    @ApiQuery({
        name: 'payment_method',
        description: 'روش پرداخت',
        required: false,
        enum: Object.values(PricingConditionType)
    })
    @ApiQuery({
        name: 'delivery_method',
        description: 'روش تحویل',
        required: false,
        enum: Object.values(PricingConditionType)
    })
    @ApiQuery({
        name: 'location_condition',
        description: 'شرایط مکانی',
        required: false,
        enum: Object.values(PricingConditionType)
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'قیمت نهایی محاسبه شده'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'محصول یا قیمت فعال یافت نشد'
    })
    calculatePrice(
        @Param('productId') productId: string,
        @Query('quantity', new DefaultValuePipe(1), ParseIntPipe) quantity: number = 1,
        @Query('customer_type') customer_type?: PricingConditionType,
        @Query('payment_method') payment_method?: PricingConditionType,
        @Query('delivery_method') delivery_method?: PricingConditionType,
        @Query('location_condition') location_condition?: PricingConditionType,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.calculatePriceForConditions(
            productId,
            {
                quantity,
                customer_type,
                payment_method,
                delivery_method,
                location_condition
            },
            language
        );
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'بروزرسانی قیمت',
        description: 'بروزرسانی اطلاعات یک قیمت موجود. کاربر باید مالک محصول یا دارای نقش مناسب باشد.'
    })
    @ApiParam({
        name: 'id',
        description: 'شناسه قیمت',
        type: String,
        required: true
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'قیمت با موفقیت بروزرسانی شد'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'قیمت یافت نشد'
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'دسترسی غیرمجاز'
    })
    update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateProductPriceDto: UpdateProductPriceDto,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.update(id, updateProductPriceDto, user.id, language);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'حذف قیمت',
        description: 'حذف یک قیمت. قیمت اصلی قابل حذف نیست.'
    })
    @ApiParam({
        name: 'id',
        description: 'شناسه قیمت',
        type: String,
        required: true
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'قیمت با موفقیت حذف شد'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'قیمت یافت نشد'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'قیمت اصلی قابل حذف نیست'
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'دسترسی غیرمجاز'
    })
    remove(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.remove(id, user.id, language);
    }

    @Post(':id/set-primary')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'تنظیم قیمت به عنوان قیمت اصلی',
        description: 'تنظیم یک قیمت به عنوان قیمت اصلی محصول. قیمت باید فعال باشد.'
    })
    @ApiParam({
        name: 'id',
        description: 'شناسه قیمت',
        type: String,
        required: true
    })
    @ApiQuery({
        name: 'product_id',
        description: 'شناسه محصول',
        required: true,
        type: String
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'قیمت با موفقیت به عنوان اصلی تنظیم شد'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'قیمت یا محصول یافت نشد'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'قیمت غیرفعال قابل تنظیم به عنوان اصلی نیست'
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'دسترسی غیرمجاز'
    })
    setPrimaryPrice(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Query('product_id') productId: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.setPrimaryPrice(productId, id, user.id, language);
    }

    @Get('stats/overview')
    @Public()
    @ApiOperation({
        summary: 'دریافت آمار قیمت‌ها',
        description: 'دریافت آمار کلی قیمت‌ها شامل تعداد، میانگین قیمت، درصد تخفیف و ...'
    })
    @ApiQuery({
        name: 'product_id',
        description: 'شناسه محصول (برای آمار یک محصول خاص)',
        required: false,
        type: String
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'آمار قیمت‌ها'
    })
    getStats(
        @Query('product_id') productId?: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productPriceService.getPriceStats(productId, language);
    }

    @Get(':id')
    @Public()
    @ApiOperation({
        summary: 'دریافت اطلاعات یک قیمت',
        description: 'دریافت اطلاعات کامل یک قیمت خاص'
    })
    @ApiParam({
        name: 'id',
        description: 'شناسه قیمت',
        type: String,
        required: true
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'اطلاعات قیمت'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'قیمت یافت نشد'
    })
    findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        // این متد نیاز به اضافه شدن در سرویس دارد
        // می‌توانید آن را به سرویس اضافه کنید
        return this.productPriceService.findByProduct(id, undefined, language);
    }
}