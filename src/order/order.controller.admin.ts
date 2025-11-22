// src/controllers/order/order.controller.admin.ts
import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { OrderStatus, SystemRole } from '@prisma/client';
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {RolesGuard} from "../common/guards/roles.guard";
import {OrderService} from "./order.service";
import {Roles} from "../common/decorators/roles.decorator";
import {OrderQueryDto} from "./dto/order-query.dto";

@ApiTags('Admin - Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/orders')
export class OrderAdminController {
    constructor(private readonly orderService: OrderService) {}

    @Get()
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({
        summary: 'دریافت تمام سفارشات',
        description: 'دریافت تمام سفارشات سیستم (فقط برای ادمین)'
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
    @ApiQuery({ name: 'order_type', required: false })
    @ApiQuery({ name: 'account_id', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiResponse({
        status: 200,
        description: 'لیست سفارشات با موفقیت بازگردانده شد'
    })
    async findAll(@Query() query: OrderQueryDto) {
        return this.orderService.findAllAdmin(query);
    }

    @Get(':id')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({
        summary: 'دریافت جزئیات سفارش',
        description: 'دریافت اطلاعات کامل یک سفارش خاص (فقط برای ادمین)'
    })
    @ApiParam({ name: 'id', description: 'شناسه سفارش' })
    @ApiResponse({
        status: 200,
        description: 'جزئیات سفارش با موفقیت بازگردانده شد'
    })
    @ApiResponse({
        status: 404,
        description: 'سفارش یافت نشد'
    })
    async findOne(@Param('id') id: string) {
        return this.orderService.findOneAdmin(id);
    }

    @Patch(':id/status')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'تغییر وضعیت سفارش',
        description: 'تغییر وضعیت سفارش توسط ادمین'
    })
    @ApiParam({ name: 'id', description: 'شناسه سفارش' })
    @ApiResponse({
        status: 200,
        description: 'وضعیت سفارش با موفقیت تغییر کرد'
    })
    @ApiResponse({
        status: 400,
        description: 'داده‌های ورودی نامعتبر'
    })
    @ApiResponse({
        status: 404,
        description: 'سفارش یافت نشد'
    })
    async updateStatus(
        @Request() req,
        @Param('id') id: string,
        @Body('status') status: OrderStatus,
        @Body('reason') reason?: string,
    ) {
        return this.orderService.updateOrderStatus(id, status, req.user.id, reason);
    }

    @Get('stats/overview')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({
        summary: 'دریافت آمار کلی سفارشات',
        description: 'دریافت آمار و نمودارهای کلی سفارشات سیستم'
    })
    @ApiResponse({
        status: 200,
        description: 'آمار کلی با موفقیت بازگردانده شد'
    })
    async getOverviewStats() {
        // این متد باید در سرویس اضافه شود
        return this.orderService.getAdminOrderStats();
    }

    @Get('user/:userId/orders')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({
        summary: 'دریافت سفارشات کاربر خاص',
        description: 'دریافت تمام سفارشات یک کاربر خاص'
    })
    @ApiParam({ name: 'userId', description: 'شناسه کاربر' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiResponse({
        status: 200,
        description: 'لیست سفارشات کاربر با موفقیت بازگردانده شد'
    })
    async getUserOrders(
        @Param('userId') userId: string,
        @Query() query: OrderQueryDto
    ) {
        return this.orderService.findAllByUser(query, userId);
    }

    @Patch('bulk/status')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'تغییر وضعیت دسته‌جمعی سفارشات',
        description: 'تغییر وضعیت چندین سفارش به صورت همزمان'
    })
    @ApiResponse({
        status: 200,
        description: 'وضعیت سفارشات با موفقیت تغییر کرد'
    })
    async bulkUpdateStatus(
        @Request() req,
        @Body() bulkUpdateDto: {
            order_ids: string[];
            status: OrderStatus;
            reason?: string;
        }
    ) {
        // این متد باید در سرویس اضافه شود
        return this.orderService.bulkUpdateOrderStatus(
            bulkUpdateDto.order_ids,
            bulkUpdateDto.status,
            req.user.id,
            bulkUpdateDto.reason
        );
    }

    @Get('analytics/daily')
    @Roles(SystemRole.ADMIN)
    @ApiOperation({
        summary: 'دریافت آمار روزانه سفارشات',
        description: 'دریافت آمار سفارشات به تفکیک روز (فقط برای ادمین اصلی)'
    })
    @ApiQuery({ name: 'days', required: false, type: Number, example: 30 })
    @ApiResponse({
        status: 200,
        description: 'آمار روزانه با موفقیت بازگردانده شد'
    })
    async getDailyAnalytics(@Query('days') days: number = 30) {
        // این متد باید در سرویس اضافه شود
        return this.orderService.getDailyOrderAnalytics(days);
    }
}