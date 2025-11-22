// src/accounts/account.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
    Query,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
} from '@nestjs/swagger';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { FileUsage, SystemRole, Language } from '@prisma/client';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import { LanguageHeader } from "../common/decorators/language.decorator";

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountController {
    constructor(private readonly accountService: AccountService) {}

    @Post()
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'ایجاد کسب‌وکار جدید' })
    @ApiResponse({ status: 201, description: 'کسب‌وکار ایجاد شد' })
    async create(
        @Request() req,
        @Body() createAccountDto: CreateAccountDto,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.create(req.user.id, createAccountDto, language);
    }

    @Get()
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'دریافت کسب‌وکارهای کاربر' })
    async findAllByUser(
        @Request() req,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.findAllByUser(req.user.id, language);
    }

    @Get(':id')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'دریافت اطلاعات کسب‌وکار' })
    async findOne(
        @Request() req,
        @Param('id') id: string,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.findOne(id, req.user.id, req.user.role, language);
    }

    @Patch(':id')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'بروزرسانی کسب‌وکار' })
    async update(
        @Request() req,
        @Param('id') id: string,
        @Body() updateAccountDto: UpdateAccountDto,
        @LanguageHeader() language: Language
    ) {
        return this.accountService.update(id, req.user.id, req.user.role, updateAccountDto, language);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'حذف کسب‌وکار' })
    async remove(@Request() req, @Param('id') id: string) {
        return this.accountService.remove(id, req.user.id, req.user.role);
    }

    // 🔥 متدهای جدید مدیریت محتوای چندزبانه
    @Post(':id/contents')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'افزودن محتوای چندزبانه به کسب‌وکار' })
    async addContent(
        @Request() req,
        @Param('id') id: string,
        @Body() contentDto: any // باید AccountContentDto تعریف شود
    ) {
        return this.accountService.createAccountContent(id, contentDto);
    }

    @Get(':id/contents')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'دریافت تمام ترجمه‌های کسب‌وکار' })
    async getTranslations(@Request() req, @Param('id') id: string) {
        return this.accountService.getAccountTranslations(id);
    }

    @Patch(':id/contents/:language')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'بروزرسانی محتوای یک زبان خاص' })
    async updateContent(
        @Request() req,
        @Param('id') id: string,
        @Param('language') language: Language,
        @Body() contentDto: any // باید Partial<AccountContentDto> تعریف شود
    ) {
        return this.accountService.updateAccountContent(id, language, contentDto);
    }

    // متدهای فایل (بدون تغییر نسبت به قبل)
    @Post(':id/files/:fileUsage')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'آپلود فایل برای کسب‌وکار' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    async setAccountFile(
        @Request() req,
        @Param('id') id: string,
        @Param('fileUsage') fileUsage: FileUsage,
        @UploadedFile() file: Express.Multer.File,
        @Body('description') description?: string,
    ) {
        return this.accountService.setAccountFile(
            id,
            req.user.id,
            req.user.role,
            file,
            fileUsage,
            description,
        );
    }

    @Delete(':id/files/:fileUsage')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'حذف فایل کسب‌وکار' })
    async removeAccountFile(
        @Request() req,
        @Param('id') id: string,
        @Param('fileUsage') fileUsage: FileUsage,
    ) {
        return this.accountService.removeAccountFile(
            id,
            req.user.id,
            req.user.role,
            fileUsage,
        );
    }

    @Get(':id/files')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'دریافت فایل‌های کسب‌وکار' })
    async getAccountFiles(
        @Request() req,
        @Param('id') id: string,
        @Query('file_usage') fileUsage?: FileUsage,
    ) {
        return this.accountService.getAccountFiles(
            id,
            req.user.id,
            req.user.role,
            fileUsage,
        );
    }

    @Get(':id/files/:fileId')
    @Roles(SystemRole.USER, SystemRole.ADMIN)
    @ApiOperation({ summary: 'دریافت اطلاعات یک فایل خاص از کسب‌وکار' })
    async getAccountFile(
        @Request() req,
        @Param('id') id: string,
        @Param('fileId') fileId: string,
    ) {
        return this.accountService.getAccountFile(
            id,
            fileId,
            req.user.id,
            req.user.role,
        );
    }
}