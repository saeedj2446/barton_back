import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
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
} from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('User - Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionUserController {
    constructor(private readonly transactionService: TransactionService) {}

    @Post()
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'ایجاد تراکنش جدید' })
    @ApiResponse({ status: 201, description: 'تراکنش ایجاد شد' })
    async create(@Request() req, @Body() createTransactionDto: CreateTransactionDto) {
        return this.transactionService.create(createTransactionDto, req.user.id);
    }

    @Get()
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت تراکنش‌های کاربر' })
    async findAll(@Request() req, @Query() query: TransactionQueryDto) {
        return this.transactionService.findAllByUser(query, req.user.id);
    }

    @Get(':id')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت جزئیات تراکنش' })
    async findOne(@Request() req, @Param('id') id: string) {
        return this.transactionService.findOne(id, req.user.id);
    }

    @Post(':id/refund')
    @HttpCode(HttpStatus.OK)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'درخواست بازپرداخت تراکنش' })
    async requestRefund(
        @Request() req,
        @Param('id') id: string,
        @Body('reason') reason?: string,
    ) {
        return this.transactionService.requestRefund(id, req.user.id, reason);
    }

    @Post('payment/initiate')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'شروع پرداخت آنلاین برای سفارش' })
    async initiateOnlinePayment(
        @Request() req,
        @Body('order_id') orderId: string,
        @Body('callback_url') callbackUrl: string,
    ) {
        return this.transactionService.initiateOnlinePayment(orderId, req.user.id, callbackUrl);
    }

    // 🔥 اضافه کردن endpoint جدید برای تأیید پرداخت
    @Post('payment/verify')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'تأیید پرداخت از درگاه' })
    async verifyPayment(
        @Body('payment_id') paymentId: string,
        @Body('gateway_data') gatewayData: any,
    ) {
        return this.transactionService.verifyPayment(paymentId, gatewayData);
    }
}
