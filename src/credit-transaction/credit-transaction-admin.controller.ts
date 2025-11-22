// src/credit-transaction/credit-transaction-admin.controller.ts
import {
    Controller,
    Get,
    Query,
    UseGuards,
    Headers,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiHeader,
} from '@nestjs/swagger';
import { CreditTransactionService } from './credit-transaction.service';
import { CreditTransactionQueryDto } from './dto/credit-transaction-query.dto';
import { SystemRole, Language } from '@prisma/client';
import { RolesGuard } from "../common/guards/roles.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { I18nService } from '../i18n/i18n.service';

@ApiTags('Admin - Credit Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/credit-transactions')
export class CreditTransactionAdminController {
    constructor(
        private readonly creditTransactionService: CreditTransactionService,
        private readonly i18nService: I18nService,
    ) {}

    private getLanguageFromHeaders(@Headers() headers: any): Language {
        const acceptLanguage = headers['accept-language'] || 'fa';
        switch (acceptLanguage.toLowerCase()) {
            case 'en':
            case 'en-us':
                return Language.en;
            case 'ar':
                return Language.ar;
            case 'fa':
            default:
                return Language.fa;
        }
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام تراکنش‌های اعتباری (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getAllTransactions(
        @Query() query: CreditTransactionQueryDto,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditTransactionService.findAllAdmin(query, language);
    }

    @Get('stats')
    @ApiOperation({ summary: 'دریافت آمار تراکنش‌های اعتباری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getTransactionsStats(@Headers() headers: any) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditTransactionService.getTransactionsStats(language);
    }
}