// src/accounts/account-admin.controller.ts
import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountService } from './account.service';
import { AccountQueryDto } from './dto/account-query.dto';
import { SystemRole, Language } from '@prisma/client';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { LanguageHeader } from "../common/decorators/language.decorator";

@ApiTags('Admin - Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/accounts')
export class AccountAdminController {
    constructor(private readonly accountService: AccountService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام کسب‌وکارها' })
    async findAll(
        @Query() query: AccountQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.findAllAdmin(query, language);
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات کامل کسب‌وکار' })
    async findOne(
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.findOneAdmin(id, language);
    }

    @Patch(':id/confirmation')
    @ApiOperation({ summary: 'تغییر وضعیت تأیید کسب‌وکار' })
    async updateConfirmation(
        @Param('id') id: string,
        @Body('confirmed') confirmed: boolean,
    ) {
        return this.accountService.updateConfirmation(id, confirmed);
    }
}