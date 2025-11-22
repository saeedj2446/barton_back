// src/plan/plan.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
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
import { PlanService } from './plan.service';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import {PurchasePlanDto} from "./dto/urchase-plan.dto";

@ApiTags('Plan - مدیریت پلن و اعتبار')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('plan')
export class PlanController {
    constructor(
        private readonly planService: PlanService,
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

    @Get('active-plans')
    @ApiOperation({ summary: 'دریافت لیست پلن‌های فعال' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getActivePlans(@Headers() headers: any) {
        const language = this.getLanguageFromHeaders(headers);
        return this.planService.getActivePlans(language);
    }

    @Post('purchase')
    @ApiOperation({ summary: 'خرید پلن اعتباری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async purchasePlan(
        @Request() req,
        @Body() purchaseDto: PurchasePlanDto,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.planService.purchasePlan(req.user.user_id, purchaseDto, language);
    }

    @Get('status')
    @ApiOperation({ summary: 'دریافت وضعیت پلن و اعتبار کاربر' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getPlanStatus(
        @Request() req,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.planService.getPlanStatus(req.user.user_id, language);
    }
}