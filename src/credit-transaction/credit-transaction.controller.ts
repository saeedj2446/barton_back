// src/credit-transaction/credit-transaction.controller.ts
import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    Request,
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
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';

@ApiTags('Credit Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credit-transactions')
export class CreditTransactionController {
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
    @ApiOperation({ summary: 'دریافت تاریخچه تراکنش‌های اعتباری کاربر' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getUserTransactions(
        @Request() req,
        @Query() query: CreditTransactionQueryDto,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditTransactionService.findByUser(req.user.user_id, query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات یک تراکنش اعتباری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getTransaction(
        @Param('id') id: string,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditTransactionService.findOne(id, language);
    }
}