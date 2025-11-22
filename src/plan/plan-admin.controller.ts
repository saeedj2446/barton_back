// src/plan/plan-admin.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
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
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SystemRole, Language } from '@prisma/client';
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { I18nService } from '../i18n/i18n.service';

@ApiTags('Admin - Plan Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/plan')
export class PlanAdminController {
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

    @Post('create')
    @ApiOperation({ summary: 'ایجاد پلن جدید' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async createPlan(
        @Body() createPlanDto: CreatePlanDto,
        @Headers() headers: any
    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.planService.createPlan(createPlanDto, language);
    }

    @Get('users')
    @ApiOperation({ summary: 'دریافت لیست کاربران و وضعیت پلن آن‌ها' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async getAllUsersPlanStatus(
        @Headers() headers: any,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('search') search?: string,

    ) {
        const language = this.getLanguageFromHeaders(headers);
        return this.planService.getAllUsersPlanStatus(page, limit, search, language);
    }

    @Post('handle-expired-plans')
    @ApiOperation({ summary: 'مدیریت پلن‌های منقضی شده' })
    @ApiHeader({ name: 'accept-language', required: false, example: 'fa' })
    async handleExpiredPlans(@Headers() headers: any) {
        const language = this.getLanguageFromHeaders(headers);
        return this.planService.handleExpiredPlans(language);
    }
}