// src/categories/categories-admin.controller.ts
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Query,
    Body,
    UseGuards
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryContentDto,  } from './dto/category-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LanguageHeader } from '../common/decorators/language.decorator';
import {UpdateCategoryContentDto} from "./dto/update-category-conten.dto";

@ApiTags('Admin - Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.CONTENT_APPROVER)
@Controller('admin/categories')
export class CategoriesAdminController {
    constructor(private readonly categoriesService: CategoriesService) {}

    // src/categories/categories-admin.controller.ts (بخش‌های مربوطه)
    @Get()
    @ApiOperation({ summary: 'دریافت تمام دسته‌بندی‌ها (ادمین)' })
    async findAll(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Query() query: CategoryQueryDto
    ) {
        return this.categoriesService.findAllWithTracking(
            query,
            language,
            user.id,
            user.id
        );
    }

    @Get('tree')
    @ApiOperation({ summary: 'دریافت درخت دسته‌بندی‌ها (ادمین)' })
    async getCategoryTree(
        @LanguageHeader() language: Language, // 🔧 اول پارامتر اجباری
        @CurrentUser() user: any,
        @Query('parent_id') parentId?: string
    ) {
        return this.categoriesService.getCategoryTreeWithTracking(
            parentId || null,
            language,
            user.id,
            user.id
        );
    }

// به همین ترتیب تمام متدهای دیگر را تصحیح کنید...

    @Get('stats')
    @ApiOperation({ summary: 'دریافت آمار دسته‌بندی‌ها (ادمین)' })
    @ApiResponse({ status: 200, description: 'آمار دریافت شد' })
    async getStats() {
        return this.categoriesService.getCategoryStats();
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت دسته‌بندی بر اساس ID (ادمین)' })
    @ApiQuery({ name: 'includeChildren', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'دسته‌بندی دریافت شد' })
    @ApiResponse({ status: 404, description: 'دسته‌بندی پیدا نشد' })
    async findOne(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Query('includeChildren') includeChildren?: boolean,

    ) {
        return this.categoriesService.findOneWithTracking(
            id,
            language,
            includeChildren === true,
            user.id,
            user.id
        );
    }

    @Get('bId/:bId')
    @ApiOperation({ summary: 'دریافت دسته‌بندی بر اساس bId (ادمین)' })
    @ApiResponse({ status: 200, description: 'دسته‌بندی دریافت شد' })
    @ApiResponse({ status: 404, description: 'دسته‌بندی پیدا نشد' })
    async findByBId(
        @CurrentUser() user: any,
        @Param('bId') bId: number,
        @LanguageHeader() language: Language
    ) {
        return this.categoriesService.findByBIdWithTracking(
            +bId,
            language,
            user.id,
            user.id
        );
    }

    @Put(':id')
    @ApiOperation({ summary: 'آپدیت دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'دسته‌بندی آپدیت شد' })
    @ApiResponse({ status: 404, description: 'دسته‌بندی پیدا نشد' })
    @ApiResponse({ status: 409, description: 'دسته‌بندی با این bId وجود دارد' })
    async update(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() updateCategoryDto: UpdateCategoryDto,
        @LanguageHeader() language: Language
    ) {
        return this.categoriesService.updateWithTracking(
            id,
            updateCategoryDto,
            language,
            user.id,
            user.id
        );
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'دسته‌بندی حذف شد' })
    @ApiResponse({ status: 404, description: 'دسته‌بندی پیدا نشد' })
    @ApiResponse({ status: 409, description: 'امکان حذف وجود ندارد' })
    async remove(
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.categoriesService.removeWithTracking(id, user.id, user.id);
    }

    @Post(':id/contents')
    @ApiOperation({ summary: 'افزودن محتوای چندزبانه به دسته‌بندی' })
    @ApiResponse({ status: 201, description: 'محتوای چندزبانه اضافه شد' })
    async addContent(
        @Param('id') id: string,
        @Body() contentDto: CreateCategoryContentDto
    ) {
        return this.categoriesService.createCategoryContent(id, contentDto);
    }

    @Put(':id/contents/:language')
    @ApiOperation({ summary: 'آپدیت محتوای چندزبانه دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'محتوای چندزبانه آپدیت شد' })
    async updateContent(
        @Param('id') id: string,
        @Param('language') language: Language,
        @Body() contentDto: UpdateCategoryContentDto
    ) {
        return this.categoriesService.updateCategoryContent(id, language, contentDto);
    }

    @Get(':id/contents')
    @ApiOperation({ summary: 'دریافت تمام محتوای چندزبانه دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'محتوای چندزبانه دریافت شد' })
    async getContents(@Param('id') id: string) {
        return this.categoriesService.getCategoryTranslations(id);
    }

    @Get('children')
    @ApiOperation({ summary: 'دریافت فرزندان یک دسته‌بندی (ادمین)' })
    @ApiQuery({ name: 'parentId', required: false })
    async getChildren(
        @LanguageHeader() language: Language,
        @CurrentUser() user: any,
        @Query('parentId') parentId?: string,
    ) {
        return this.categoriesService.getChildrenWithTracking(
            parentId,
            language,
            user.id,
            user.id
        );
    }

    // ==================== اندپوینت‌های جدید برای آمار و تحلیل ====================

    @Get('analytics/popular')
    @ApiOperation({ summary: 'دریافت دسته‌بندی‌های پرطرفدار (ادمین)' })
    @ApiQuery({ name: 'days', required: false, type: Number, description: 'تعداد روزهای گذشته' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'تعداد دسته‌بندی‌ها' })
    @ApiResponse({ status: 200, description: 'دسته‌بندی‌های پرطرفدار دریافت شد' })
    async getPopularCategories(
        @Query('days') days: number = 30,
        @Query('limit') limit: number = 10
    ) {
        return this.categoriesService.getPopularCategories(days, limit);
    }

    @Get('analytics/user-engagement')
    @ApiOperation({ summary: 'دریافت آمار تعامل کاربران با دسته‌بندی‌ها' })
    @ApiQuery({ name: 'days', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'آمار تعامل دریافت شد' })
    async getUserEngagementAnalytics(
        @Query('days') days: number = 30
    ) {
        return this.categoriesService.getUserEngagementAnalytics(days);
    }

    @Post(':id/specs')
    @ApiOperation({ summary: 'اضافه کردن ویژگی به دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'ویژگی اضافه شد' })
    async addSpec(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() specData: any,
        @LanguageHeader() language: Language
    ) {
        const category = await this.categoriesService.findOneWithTracking(
            id,
            language,
            false,
            user.id,
            user.id
        ) as any;
        const updatedSpecs = [...(category.specs || []), specData];

        return this.categoriesService.updateWithTracking(
            id,
            { specs: updatedSpecs },
            language,
            user.id,
            user.id
        );
    }

    @Delete(':id/specs/:specKey')
    @ApiOperation({ summary: 'حذف ویژگی از دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'ویژگی حذف شد' })
    async removeSpec(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Param('specKey') specKey: string,
        @LanguageHeader() language: Language
    ) {
        const category = await this.categoriesService.findOneWithTracking(
            id,
            language,
            false,
            user.id,
            user.id
        ) as any;
        const updatedSpecs = (category.specs || []).filter((spec: any) => spec.key !== specKey);

        return this.categoriesService.updateWithTracking(
            id,
            { specs: updatedSpecs },
            language,
            user.id,
            user.id
        );
    }

    @Post(':id/units')
    @ApiOperation({ summary: 'اضافه کردن واحد به دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'واحد اضافه شد' })
    async addUnit(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() unitData: any,
        @LanguageHeader() language: Language
    ) {
        const category = await this.categoriesService.findOneWithTracking(
            id,
            language,
            false,
            user.id,
            user.id
        ) as any;
        const updatedUnits = [...(category.units || []), unitData];

        return this.categoriesService.updateWithTracking(
            id,
            { units: updatedUnits },
            language,
            user.id,
            user.id
        );
    }

    @Delete(':id/units/:unitKey')
    @ApiOperation({ summary: 'حذف واحد از دسته‌بندی' })
    @ApiResponse({ status: 200, description: 'واحد حذف شد' })
    async removeUnit(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Param('unitKey') unitKey: string,
        @LanguageHeader() language: Language
    ) {
        const category = await this.categoriesService.findOneWithTracking(
            id,
            language,
            false,
            user.id,
            user.id
        ) as any;
        const updatedUnits = (category.units || []).filter((unit: any) => unit.key !== unitKey);

        return this.categoriesService.updateWithTracking(
            id,
            { units: updatedUnits },
            language,
            user.id,
            user.id
        );
    }
}