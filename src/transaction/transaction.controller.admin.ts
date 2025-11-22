import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
    Request,
    Delete,
    HttpCode,
    HttpStatus, Post,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionStatus, SystemRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Admin - Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/transactions')
export class TransactionAdminController {
    constructor(private readonly transactionService: TransactionService) {}

    @Get()
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت تمام تراکنش‌ها (ادمین)' })
    async findAll(@Query() query: TransactionQueryDto) {
        // 🔥 توجه: این متد نیاز به پیاده‌سازی جداگانه دارد
        // در حال حاضر از متد کاربر استفاده می‌کند که ممکن است مشکل ایجاد کند
        const modifiedQuery = {
            ...query,
            limit: query.limit || 20
        };
        // 🔥 این خطا ایجاد می‌کند - باید متد جداگانه برای ادمین بسازید
        return this.transactionService.findAllByUser(modifiedQuery, 'admin');
    }

    @Get(':id')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت جزئیات تراکنش (ادمین)' })
    async findOne(@Param('id') id: string) {
        // 🔥 این هم نیاز به متد جداگانه دارد
        return this.transactionService.findOne(id, 'admin');
    }

    @Patch(':id/status')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'تغییر وضعیت تراکنش' })
    async updateStatus(
        @Request() req,
        @Param('id') id: string,
        @Body('status') status: TransactionStatus,
        @Body('reason') reason?: string,
    ) {
        return this.transactionService.updateTransactionStatus(id, status, req.user.id, reason);
    }

    @Post(':id/refund/approve')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'تأیید بازپرداخت' })
    async approveRefund(
        @Request() req,
        @Param('id') id: string,
        @Body('notes') notes?: string,
    ) {
        return this.transactionService.approveRefund(id, req.user.id, notes);
    }

    @Post(':id/refund/reject')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'رد درخواست بازپرداخت' })
    async rejectRefund(
        @Request() req,
        @Param('id') id: string,
        @Body('reason') reason: string,
    ) {
        return this.transactionService.rejectRefund(id, req.user.id, reason);
    }

    @Get('stats/overview')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت آمار تراکنش‌ها' })
    async getTransactionStats() {
        return this.transactionService.getTransactionStats();
    }
}