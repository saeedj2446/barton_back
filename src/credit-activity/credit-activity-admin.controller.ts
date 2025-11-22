// src/credit-activity/credit-activity-admin.controller.ts
import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    Body,
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
import { CreditActivityService } from './credit-activity.service';
import { CreditTransactionQueryDto } from '../credit-transaction/dto/credit-transaction-query.dto';
import { CreditActivityStatus, Language } from '@prisma/client';
import { SystemRole } from '@prisma/client';
import { RolesGuard } from "../common/guards/roles.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { I18nService } from '../i18n/i18n.service';

@ApiTags('Admin - Credit Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/credit-activities')
export class CreditActivityAdminController {
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

    @Get()
    @ApiOperation({ summary: 'دریافت تمام فعالیت‌های اعتباری (ادمین)' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getAllActivities(
        @Query() query: CreditTransactionQueryDto,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditActivityService.findAllAdmin(query, language);
    }

    @Get('stats')
    @ApiOperation({ summary: 'دریافت آمار فعالیت‌های اعتباری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getActivitiesStats(@Headers() headers: any) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditActivityService.getActivitiesStats(language);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'تغییر وضعیت فعالیت اعتباری' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async updateActivityStatus(
        @Headers() headers: any,
        @Param('id') id: string,
        @Body('status') status: CreditActivityStatus,
        @Body('description') description?: string,

    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.creditActivityService.updateStatus(id, status, description, language);
    }
}