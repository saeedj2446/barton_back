// src/file/file-admin.controller.ts
import {
    Controller,
    Get,
    Delete,
    Param,
    Query,
    UseGuards,
    Post,
    Body,
    Put,
    UseInterceptors,
    UploadedFile,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole, FileUsage } from '@prisma/client';
import { UploadFileDto } from './dto/upload-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';

@ApiTags('Admin - File Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN)
@Controller('admin/files')
export class FileAdminController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload-for-user')
    @ApiOperation({ summary: 'آپلود فایل برای کاربر خاص (توسط ادمین)' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFileForUser(
        @UploadedFile() file: Express.Multer.File,
        @Body() uploadDto: UploadFileDto & { target_user_id: string },
        @Req() req,
    ) {
        return this.fileService.uploadFileForUser(file, uploadDto, req.user.user_id);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت لیست تمام فایل‌های سیستم با قابلیت فیلتر و جستجو' })
    async getAllFiles(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 50,
        @Query('file_usage') file_usage?: FileUsage,
        @Query('user_id') user_id?: string,
        @Query('account_id') account_id?: string,
        @Query('product_id') product_id?: string,
        @Query('search') search?: string,
        @Query('start_date') start_date?: string,
        @Query('end_date') end_date?: string,
    ) {
        const filters = {
            page: Math.max(1, page),
            limit: Math.min(100, Math.max(1, limit)),
            file_usage,
            user_id,
            account_id,
            product_id,
            search,
            start_date: start_date ? new Date(start_date) : undefined,
            end_date: end_date ? new Date(end_date) : undefined,
        };

        return this.fileService.getAllFiles(filters);
    }

    @Get('stats')
    @ApiOperation({ summary: 'دریافت آمار فایل‌های سیستم' })
    async getFilesStats() {
        return this.fileService.getFilesStats();
    }

    @Get('user/:user_id/files')
    @ApiOperation({ summary: 'دریافت فایل‌های یک کاربر خاص' })
    async getUserFilesByAdmin(
        @Param('user_id') user_id: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('file_usage') file_usage?: FileUsage,
    ) {
        return this.fileService.getUserFiles(user_id, {
            file_usage,
            page: Math.max(1, page),
            limit: Math.min(50, Math.max(1, limit))
        });
    }

    @Get('account/:account_id/files')
    @ApiOperation({ summary: 'دریافت فایل‌های یک کسب‌وکار خاص' })
    async getAccountFiles(
        @Param('account_id') account_id: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('file_usage') file_usage?: FileUsage,
    ) {
        return this.fileService.getAccountFiles(account_id, {
            file_usage,
            page: Math.max(1, page),
            limit: Math.min(50, Math.max(1, limit))
        });
    }

    @Get('product/:product_id/files')
    @ApiOperation({ summary: 'دریافت فایل‌های یک محصول خاص' })
    async getProductFiles(
        @Param('product_id') product_id: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('file_usage') file_usage?: FileUsage,
    ) {
        return this.fileService.getProductFiles(product_id, {
            file_usage,
            page: Math.max(1, page),
            limit: Math.min(50, Math.max(1, limit))
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات کامل یک فایل' })
    async getFileDetails(@Param('id') id: string) {
        return this.fileService.getFileDetails(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'ویرایش فایل توسط ادمین' })
    async adminUpdateFile(
        @Param('id') id: string,
        @Body() updateDto: UpdateFileDto,
    ) {
        return this.fileService.adminUpdateFile(id, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف فایل توسط ادمین' })
    async adminDeleteFile(@Param('id') id: string) {
        return this.fileService.adminDeleteFile(id);
    }

    @Post('bulk-delete')
    @ApiOperation({ summary: 'حذف گروهی فایل‌ها' })
    async bulkDeleteFiles(@Body() body: { file_ids: string[] }) {
        return this.fileService.bulkDeleteFiles(body.file_ids);
    }

    @Post('cleanup-orphaned')
    @ApiOperation({ summary: 'پاکسازی فایل‌های سرگردان' })
    async cleanupOrphanedFiles() {
        return this.fileService.cleanupOrphanedFiles();
    }

    @Get('storage/usage')
    @ApiOperation({ summary: 'دریافت آمار استفاده از فضای ذخیره‌سازی' })
    async getStorageUsage() {
        return this.fileService.getStorageUsage();
    }
}