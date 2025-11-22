// src/account-users/account-user.controller.ts
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
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
import { AccountUserService } from './account-user.service';
import { AddUserToAccountDto } from './dto/add-user-to-account.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SystemRole, Language } from '@prisma/client';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { LanguageHeader } from "../common/decorators/language.decorator";

@ApiTags('Account Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts/:accountId/users')
export class AccountUserController {
    constructor(private readonly accountUserService: AccountUserService) {}

    @Post()
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'اضافه کردن کاربر به کسب‌وکار' })
    @ApiResponse({ status: 201, description: 'کاربر با موفقیت اضافه شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'کسب‌وکار یا کاربر پیدا نشد' })
    @ApiResponse({ status: 409, description: 'کاربر قبلاً اضافه شده است' })
    async addUserToAccount(
        @Request() req,
        @Param('accountId') accountId: string,
        @Body() addUserDto: AddUserToAccountDto,
        @LanguageHeader() language: Language
    ) {
        return this.accountUserService.addUserToAccount(
            accountId,
            req.user.id,
            addUserDto,
            language
        );
    }

    @Get()
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'دریافت کاربران یک کسب‌وکار' })
    @ApiResponse({ status: 200, description: 'لیست کاربران کسب‌وکار' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    async getAccountUsers(
        @Request() req,
        @Param('accountId') accountId: string,
        @LanguageHeader() language: Language
    ) {
        return this.accountUserService.getAccountUsers(
            accountId,
            req.user.id,
            req.user.role,
            language
        );
    }

    @Patch(':user_id/role')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'تغییر نقش کاربر در کسب‌وکار' })
    @ApiResponse({ status: 200, description: 'نقش کاربر با موفقیت تغییر کرد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'رابطه کاربری پیدا نشد' })
    async updateUserRole(
        @Request() req,
        @Param('accountId') accountId: string,
        @Param('user_id') user_id: string,
        @Body() updateRoleDto: UpdateUserRoleDto,
        @LanguageHeader() language: Language
    ) {
        return this.accountUserService.updateUserRole(
            accountId,
            req.user.id,
            user_id,
            updateRoleDto,
            language
        );
    }

    @Delete(':user_id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'حذف کاربر از کسب‌وکار' })
    @ApiResponse({ status: 204, description: 'کاربر با موفقیت حذف شد' })
    @ApiResponse({ status: 403, description: 'دسترسی غیرمجاز' })
    @ApiResponse({ status: 404, description: 'رابطه کاربری پیدا نشد' })
    async removeUserFromAccount(
        @Request() req,
        @Param('accountId') accountId: string,
        @Param('user_id') user_id: string,
    ) {
        return this.accountUserService.removeUserFromAccount(
            accountId,
            req.user.id,
            user_id
        );
    }
}