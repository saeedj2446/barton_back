// src/controllers/order/order.controller.user.ts
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
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

import { OrderStatus, Language } from '@prisma/client';
import {JwtAuthGuard} from "../common/guards/jwt-auth.guard";
import {OrderService} from "./order.service";
import {OrderQueryDto} from "./dto/order-query.dto";
import {CreateOrderDto} from "./dto/create-order.dto";

@ApiTags('User - Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/orders')
export class OrderUserController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    @ApiOperation({
        summary: 'ایجاد سفارش جدید',
        description: 'ایجاد سفارش جدید برای کاربر جاری'
    })
    @ApiResponse({
        status: 201,
        description: 'سفارش با موفقیت ایجاد شد'
    })
    @ApiResponse({
        status: 400,
        description: 'داده‌های ورودی نامعتبر'
    })
    @ApiResponse({
        status: 404,
        description: 'محصول یا اکانت یافت نشد'
    })
    async create(
        @Request() req,
        @Body() createOrderDto: CreateOrderDto
    ) {
        return this.orderService.create(createOrderDto, req.user.id);
    }

    @Get()
    @ApiOperation({
        summary: 'دریافت لیست سفارشات کاربر',
        description: 'دریافت تمام سفارشات کاربر جاری با امکان فیلتر و صفحه‌بندی'
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
    async findAll(
        @Request() req,
        @Query() query: OrderQueryDto
    ) {
        return this.orderService.findAllByUser(query, req.user.id);
    }

    @Get('grouped-by-seller')
    @ApiOperation({
        summary: 'دریافت سفارشات گروه‌بندی شده بر اساس فروشنده',
        description: 'دریافت سفارشات کاربر به صورت گروه‌بندی شده بر اساس فروشنده'
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
    @ApiQuery({ name: 'order_type', required: false })
    @ApiQuery({ name: 'account_id', required: false })
    @ApiResponse({
        status: 200,
        description: 'سفارشات گروه‌بندی شده با موفقیت بازگردانده شد'
    })
    async findGroupedBySeller(
        @Request() req,
        @Query() query: OrderQueryDto
    ) {
        return this.orderService.findUserOrdersGroupedBySeller(query, req.user.id);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'دریافت جزئیات سفارش',
        description: 'دریافت اطلاعات کامل یک سفارش خاص'
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
    @ApiResponse({
        status: 403,
        description: 'دسترسی به سفارش مورد نظر ندارید'
    })
    async findOne(
        @Request() req,
        @Param('id') id: string
    ) {
        return this.orderService.findOne(id, req.user.id);
    }

    @Patch(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'لغو سفارش',
        description: 'لغو سفارش در صورت امکان'
    })
    @ApiParam({ name: 'id', description: 'شناسه سفارش' })
    @ApiResponse({
        status: 200,
        description: 'سفارش با موفقیت لغو شد'
    })
    @ApiResponse({
        status: 400,
        description: 'امکان لغو سفارش وجود ندارد'
    })
    @ApiResponse({
        status: 404,
        description: 'سفارش یافت نشد'
    })
    async cancel(
        @Request() req,
        @Param('id') id: string,
        @Body('reason') reason?: string
    ) {
        return this.orderService.cancelOrder(id, req.user.id, reason);
    }

    @Get('seller/orders')
    @ApiOperation({
        summary: 'دریافت سفارشات فروشنده',
        description: 'دریافت سفارشات مربوط به فروشنده جاری'
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
    @ApiQuery({ name: 'order_type', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiResponse({
        status: 200,
        description: 'لیست سفارشات فروشنده با موفقیت بازگردانده شد'
    })
    async findSellerOrders(
        @Request() req,
        @Query() query: OrderQueryDto
    ) {
        return this.orderService.findSellerOrders(query, req.user.id);
    }

    @Patch('seller/orders/:id/status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'تغییر وضعیت سفارش توسط فروشنده',
        description: 'تغییر وضعیت سفارش توسط فروشنده مربوطه'
    })
    @ApiParam({ name: 'id', description: 'شناسه سفارش' })
    @ApiResponse({
        status: 200,
        description: 'وضعیت سفارش با موفقیت تغییر کرد'
    })
    @ApiResponse({
        status: 400,
        description: 'تغییر وضعیت مجاز نیست'
    })
    @ApiResponse({
        status: 404,
        description: 'سفارش یافت نشد یا دسترسی ندارید'
    })
    async updateSellerOrderStatus(
        @Request() req,
        @Param('id') id: string,
        @Body('status') status: OrderStatus,
        @Body('reason') reason?: string
    ) {
        return this.orderService.updateOrderStatusBySeller(id, status, req.user.id, reason);
    }

    @Get('stats/summary')
    @ApiOperation({
        summary: 'دریافت آمار خلاصه سفارشات',
        description: 'دریافت آمار کلی سفارشات کاربر'
    })
    @ApiResponse({
        status: 200,
        description: 'آمار سفارشات با موفقیت بازگردانده شد'
    })
    async getOrderStats(@Request() req) {
        // این متد باید در سرویس اضافه شود
        return this.orderService.getUserOrderStats(req.user.id);
    }
}