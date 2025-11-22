// src/controllers/product/product-admin.controller.ts
import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
    Delete,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    ClassSerializerInterceptor
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam
} from '@nestjs/swagger';
import { Language, SystemRole, ProductStatus, AccountActivityType } from '@prisma/client';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ProductAdminService } from "./service/product.admin.service";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { LanguageHeader } from "../common/decorators/language.decorator";

@ApiTags('Admin - Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR, SystemRole.CONTENT_APPROVER)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('admin/products')
export class ProductAdminController {
    constructor(private readonly productAdminService: ProductAdminService) {}

    @Get('review')
    @ApiOperation({
        summary: 'دریافت محصولات برای بررسی',
        description: 'دریافت محصولات در انتظار بررسی مدیریتی'
    })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'شماره صفحه' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد در هر صفحه' })
    @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'EDIT_PENDING'], description: 'فیلتر وضعیت', isArray: true })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'جستجوی متنی' })
    @ApiQuery({ name: 'category_id', required: false, type: String, description: 'شناسه دسته‌بندی' })
    @ApiQuery({ name: 'account_id', required: false, type: String, description: 'شناسه حساب' })
    @ApiQuery({ name: 'user_id', required: false, type: String, description: 'شناسه کاربر' })
    @ApiQuery({ name: 'date_from', required: false, type: Date, description: 'تاریخ از' })
    @ApiQuery({ name: 'date_to', required: false, type: Date, description: 'تاریخ تا' })
    @ApiQuery({ name: 'sort_by', required: false, enum: ['oldest', 'newest', 'status', 'user', 'account'], description: 'مرتب‌سازی' })
    @ApiResponse({ status: 200, description: 'لیست محصولات برای بررسی' })
    async getProductsForReview(
        @CurrentUser() user: any,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('status') status?: ProductStatus[],
        @Query('search') search?: string,
        @Query('category_id') category_id?: string,
        @Query('account_id') account_id?: string,
        @Query('user_id') user_id?: string,
        @Query('date_from') date_from?: Date,
        @Query('date_to') date_to?: Date,
        @Query('sort_by') sort_by?: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.getProductsForReview({
            page,
            limit,
            status,
            search,
            category_id,
            account_id,
            user_id,
            date_from,
            date_to,
            sort_by,
            language
        });
    }

    @Post(':id/approve')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({
        summary: 'تایید محصول',
        description: 'تایید یک محصول توسط مدیریت'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'محصول تایید شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async approveProduct(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() options: {
            notes?: string;
            auto_boost?: boolean;
            boost_power?: number;
        } = {},
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.approveProduct(id, user.id, {
            ...options,
            language
        });
    }

    @Post(':id/reject')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
    @ApiOperation({
        summary: 'رد محصول',
        description: 'رد یک محصول توسط مدیریت'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'محصول رد شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async rejectProduct(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() options: {
            reason: string;
            rejection_code?: string;
            allow_resubmit?: boolean;
        },
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.rejectProduct(id, user.id, {
            ...options,
            language
        });
    }

    @Post(':id/suspend')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({
        summary: 'تعلیق محصول',
        description: 'تعلیق موقت یک محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'محصول تعلیق شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async suspendProduct(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() options: {
            reason: string;
            duration_days?: number;
            suspend_related_products?: boolean;
        },
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.suspendProduct(id, user.id, {
            ...options,
            language
        });
    }

    @Post(':id/unsuspend')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({
        summary: 'فعال‌سازی مجدد محصول',
        description: 'فعال‌سازی مجدد محصول تعلیق شده'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'محصول فعال شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async unsuspendProduct(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.unsuspendProduct(id, user.id, language);
    }

    @Post('bulk-update')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({
        summary: 'بروزرسانی دسته‌جمعی',
        description: 'بروزرسانی دسته‌جمعی محصولات'
    })
    @ApiResponse({ status: 200, description: 'عملیات دسته‌جمعی انجام شد' })
    async bulkUpdateProducts(
        @CurrentUser() user: any,
        @Body() data: {
            product_ids: string[];
            action: string;
            options?: any;
        },
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.bulkUpdateProducts(
            data.product_ids,
            data.action,
            user.id,
            {
                ...data.options,
                language
            }
        );
    }

    @Get('search')
    @ApiOperation({
        summary: 'جستجوی پیشرفته مدیریتی',
        description: 'جستجوی پیشرفته محصولات با فیلترهای مدیریتی'
    })
    @ApiQuery({ name: 'query', required: false, type: String, description: 'عبارت جستجو' })
    @ApiQuery({ name: 'status', required: false, enum: ProductStatus, description: 'فیلتر وضعیت', isArray: true })
    @ApiQuery({ name: 'category_id', required: false, type: String, description: 'شناسه دسته‌بندی' })
    @ApiQuery({ name: 'account_id', required: false, type: String, description: 'شناسه حساب' })
    @ApiQuery({ name: 'user_id', required: false, type: String, description: 'شناسه کاربر' })
    @ApiQuery({ name: 'has_images', required: false, type: Boolean, description: 'دارای تصویر' })
    @ApiQuery({ name: 'has_video', required: false, type: Boolean, description: 'دارای ویدئو' })
    @ApiQuery({ name: 'price_min', required: false, type: Number, description: 'حداقل قیمت' })
    @ApiQuery({ name: 'price_max', required: false, type: Number, description: 'حداکثر قیمت' })
    @ApiQuery({ name: 'stock_min', required: false, type: Number, description: 'حداقل موجودی' })
    @ApiQuery({ name: 'stock_max', required: false, type: Number, description: 'حداکثر موجودی' })
    @ApiQuery({ name: 'boost_active', required: false, type: Boolean, description: 'بوست فعال' })
    @ApiQuery({ name: 'date_from', required: false, type: Date, description: 'تاریخ از' })
    @ApiQuery({ name: 'date_to', required: false, type: Date, description: 'تاریخ تا' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'شماره صفحه' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد در هر صفحه' })
    @ApiQuery({ name: 'sort_by', required: false, enum: ['recent', 'oldest', 'status', 'popular', 'price_low', 'price_high'], description: 'مرتب‌سازی' })
    @ApiResponse({ status: 200, description: 'نتایج جستجو' })
    async adminSearchProducts(
        @Query() filters: any,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.adminSearchProducts({
            ...filters,
            language
        });
    }

    @Get('stats/overview')
    @ApiOperation({
        summary: 'آمار کلی محصولات',
        description: 'دریافت آمار و گزارشات کلی محصولات'
    })
    @ApiQuery({ name: 'date_from', required: false, type: Date, description: 'تاریخ از' })
    @ApiQuery({ name: 'date_to', required: false, type: Date, description: 'تاریخ تا' })
    @ApiQuery({ name: 'category_id', required: false, type: String, description: 'شناسه دسته‌بندی' })
    @ApiQuery({ name: 'account_activity_type', required: false, enum: AccountActivityType, description: 'نوع فعالیت حساب' })
    @ApiResponse({ status: 200, description: 'آمار کلی' })
    async getAdminStats(
        @Query('date_from') date_from?: Date,
        @Query('date_to') date_to?: Date,
        @Query('category_id') category_id?: string,
        @Query('account_activity_type') account_activity_type?: AccountActivityType,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.getAdminStats({
            date_from,
            date_to,
            category_id,
            account_activity_type,
            language
        });
    }

    @Get(':id/audit-logs')
    @ApiOperation({
        summary: 'تاریخچه تغییرات محصول',
        description: 'دریافت تاریخچه تغییرات و فعالیت‌های محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'شماره صفحه' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد در هر صفحه' })
    @ApiQuery({ name: 'action_types', required: false, type: [String], description: 'انواع فعالیت' })
    @ApiResponse({ status: 200, description: 'تاریخچه تغییرات' })
    async getProductAuditLog(
        @Param('id') id: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('action_types') action_types?: string[],
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.getProductAuditLog(id, {
            page,
            limit,
            action_types,
            language
        });
    }

    @Delete(':id/force')
    @Roles(SystemRole.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'حذف اجباری محصول',
        description: 'حذف کامل محصول از سیستم (فقط برای ادمین)'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 204, description: 'محصول حذف شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async forceDeleteProduct(
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.productAdminService.forceDeleteProduct(id, user.id);
    }

    @Patch(':id/category')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({
        summary: 'تغییر دسته‌بندی محصول',
        description: 'تغییر دسته‌بندی یک محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'دسته‌بندی تغییر کرد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async changeProductCategory(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body('new_category_id') newCategoryId: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.changeProductCategory(id, newCategoryId, user.id, language);
    }

    @Get('export')
    @Roles(SystemRole.ADMIN)
    @ApiOperation({
        summary: 'خروجی محصولات',
        description: 'دریافت خروجی Excel از محصولات'
    })
    @ApiQuery({ name: 'format', required: false, enum: ['excel', 'csv'], description: 'فرمت خروجی' })
    @ApiQuery({ name: 'filters', required: false, type: String, description: 'فیلترها به صورت JSON' })
    @ApiResponse({ status: 200, description: 'فایل خروجی' })
    async exportProducts(
        @Query('format') format: string = 'excel',
        @Query('filters') filters?: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        const parsedFilters = filters ? JSON.parse(filters) : {};
        return this.productAdminService.exportProducts(parsedFilters, format, language);
    }

    @Post(':id/boost')
    @Roles(SystemRole.ADMIN, SystemRole.OPERATOR)
    @ApiOperation({
        summary: 'افزایش قدرت نمایش محصول',
        description: 'افزایش قدرت نمایش محصول در نتایج جستجو'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 200, description: 'بوست اعمال شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async boostProduct(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() options: {
            boost_power: number;
            duration_days: number;
            notes?: string;
        },
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.boostProduct(id, user.id, options, language);
    }

    @Delete(':id/boost')
    @Roles(SystemRole.ADMIN, SystemRole.OPERATOR)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'حذف بوست محصول',
        description: 'حذف قدرت نمایش افزایش یافته محصول'
    })
    @ApiParam({ name: 'id', description: 'شناسه محصول', type: String })
    @ApiResponse({ status: 204, description: 'بوست حذف شد' })
    @ApiResponse({ status: 404, description: 'محصول یافت نشد' })
    async removeBoost(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.removeBoost(id, user.id, language);
    }

    @Get('moderation/queue')
    @ApiOperation({
        summary: 'صف بررسی محصولات',
        description: 'دریافت وضعیت فعلی صف بررسی محصولات'
    })
    @ApiQuery({ name: 'moderator_id', required: false, type: String, description: 'شناسه مودریتور' })
    @ApiResponse({ status: 200, description: 'وضعیت صف بررسی' })
    async getModerationQueue(
        @Query('moderator_id') moderator_id?: string,
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.getModerationQueue(moderator_id, language);
    }

    @Post('moderation/assign')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({
        summary: 'اختصاص محصول به مودریتور',
        description: 'اختصاص محصولات برای بررسی به مودریتور خاص'
    })
    @ApiResponse({ status: 200, description: 'محصولات اختصاص داده شدند' })
    async assignToModerator(
        @CurrentUser() user: any,
        @Body() data: {
            product_ids: string[];
            moderator_id: string;
            notes?: string;
        },
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.assignToModerator(data.product_ids, data.moderator_id, user.id, data.notes, language);
    }

    @Get('analytics/performance')
    @Roles(SystemRole.ADMIN)
    @ApiOperation({
        summary: 'تحلیل عملکرد محصولات',
        description: 'تحلیل عملکرد و اثربخشی محصولات در سیستم'
    })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['7d', '30d', '90d', '1y'], description: 'بازه زمانی' })
    @ApiQuery({ name: 'metric', required: false, enum: ['views', 'conversions', 'revenue', 'engagement'], description: 'معیار سنجش' })
    @ApiResponse({ status: 200, description: 'داده‌های تحلیل عملکرد' })
    async getPerformanceAnalytics(
        @Query('timeframe') timeframe: string = '30d',
        @Query('metric') metric: string = 'views',
        @LanguageHeader() language: Language = Language.fa
    ) {
        return this.productAdminService.getPerformanceAnalytics(timeframe, metric, language);
    }

    @Post('cache/clear')
    @Roles(SystemRole.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'پاکسازی کش محصولات',
        description: 'پاکسازی کش‌های مربوط به محصولات'
    })
    @ApiResponse({ status: 204, description: 'کش پاکسازی شد' })
    async clearProductCaches(
        @CurrentUser() user: any
    ) {
        return this.productAdminService.clearAllProductCaches();
    }
}