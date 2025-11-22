// src/account-users/account-user-admin.controller.ts
import {
    Controller,
    Get,
    Delete,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountUserService } from './account-user.service';
import { AccountUserQueryDto } from './dto/account-user-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, Language } from '@prisma/client';
import { LanguageHeader } from "../common/decorators/language.decorator";

@ApiTags('Admin - Account Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/account-users')
export class AccountUserAdminController {
    constructor(private readonly accountUserService: AccountUserService) {}

    @Get()
    @ApiOperation({ summary: 'دریافت تمام روابط کاربران و کسب‌وکارها' })
    async getAllAccountUsers(
        @Query() query: AccountUserQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.accountUserService.getAllAccountUsersAdmin(query, language);
    }

    @Get('account/:accountId')
    @ApiOperation({ summary: 'دریافت کاربران یک کسب‌وکار خاص' })
    async getAccountUsersAdmin(
        @Param('accountId') accountId: string,
        @LanguageHeader() language: Language
    ) {
        return this.accountUserService.getAccountUsersAdmin(accountId, language);
    }

    @Get('user/:user_id')
    @ApiOperation({ summary: 'دریافت کسب‌وکارهای یک کاربر خاص' })
    async getUserAccountsAdmin(
        @Param('user_id') user_id: string,
        @LanguageHeader() language: Language
    ) {
        return this.accountUserService.getUserAccountsAdmin(user_id, language);
    }

    @Delete(':accountId/user/:user_id')
    @ApiOperation({ summary: 'حذف کاربر از کسب‌وکار (ادمین)' })
    async removeUserFromAccountAdmin(
        @Param('accountId') accountId: string,
        @Param('user_id') user_id: string,
    ) {
        return this.accountUserService.removeUserFromAccountAdmin(accountId, user_id);
    }
}