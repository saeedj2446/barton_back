// src/credit-activity/credit-activity.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
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
import { CreditActivityService } from './credit-activity.service';
import { CreditTransactionQueryDto } from '../credit-transaction/dto/credit-transaction-query.dto';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import {CreateCreditActivityDto} from "./dto/credit-activity.dto";

@ApiTags('Credit Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credit-activities')
export class CreditActivityController {
    constructor(
        private readonly creditActivityService: CreditActivityService,
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

    @Post()
    @ApiOperation({ summary: 'ایجاد فعالیت اعتباری جدید' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async createActivity(
        @Request() req,
        @Body() createDto: CreateCreditActivityDto,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        // معمولاً این متد از سرویس‌های دیگر فراخوانی می‌شود
        return this.creditActivityService.create(createDto, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تاریخچه فعالیت‌های اعتباری کاربر' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getUserActivities(
        @Request() req,
        @Query() query: CreditTransactionQueryDto,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditActivityService.findByUser(req.user.user_id, query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات یک فعالیت اعتباری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getActivity(
        @Param('id') id: string,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditActivityService.findOne(id, language);
    }
}