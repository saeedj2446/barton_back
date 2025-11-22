// src/file/file.controller.ts
import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Req,
    Res,
    Query,
    Header,
    StreamableFile,
    BadRequestException, HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { FileService } from './file.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Response } from 'express';
import { FileUsage } from '@prisma/client';

// 🔥 اضافه کردن این تایپ برای Fastify
interface FastifyRequestWithFile extends Request {
    file: () => Promise<{
        fieldname: string;
        filename: string;
        encoding: string;
        mimetype: string;
        toBuffer: () => Promise<Buffer>;
    }>;
}

@ApiTags('File Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @ApiOperation({ summary: 'آپلود فایل جدید در پوشه کاربر جاری' })
    @ApiConsumes('multipart/form-data')
    async uploadFile(
        @Req() req: any,
    ) {
        try {
            const data = await req.file();

            if (!data) {
                throw new BadRequestException('فایل یافت نشد');
            }

            const fields = data.fields || {};

            // بررسی فایل یوزیج
            if (!fields.file_usage?.value) {
                throw new BadRequestException('فیلد file_usage الزامی است');
            }

            const uploadDto: UploadFileDto = {
                file_usage: fields.file_usage.value as FileUsage,
                description: fields.description?.value || undefined,
                maxWidth: fields.maxWidth?.value ? parseInt(fields.maxWidth.value) : undefined,
                maxHeight: fields.maxHeight?.value ? parseInt(fields.maxHeight.value) : undefined,
                maxSizeKB: fields.maxSizeKB?.value ? parseInt(fields.maxSizeKB.value) : undefined,
                product_id: fields.product_id?.value || undefined,
                account_id: fields.account_id?.value || undefined,
            };

            const file = {
                fieldname: data.fieldname,
                originalname: data.filename,
                encoding: data.encoding,
                mimetype: data.mimetype,
                buffer: await data.toBuffer(),
                size: (await data.toBuffer()).length,
            };

            return this.fileService.uploadFile(file, uploadDto, req.user.id);

        } catch (error) {
            // 🔥 لاگ خطا برای دیباگ
            console.error('📌 Upload controller error:', error);

            // اگر خطا از نوع HttpException است، همان را پرتاب کن
            if (error instanceof HttpException) {
                throw error;
            }

            // برای خطاهای دیگر، یک خطای استاندارد برگردان
            throw new BadRequestException(
                error.message || 'خطا در پردازش فایل'
            );
        }
    }



    
    @Post('replace/:id')
    @ApiOperation({ summary: 'جایگزینی فایل موجود با فایل جدید' })
    @ApiConsumes('multipart/form-data')
    async replaceFile(
        @Param('id') id: string,
        @Req() req: any,
    ) {
        try {
            console.log('🔍 Starting replace file...');

            // 🔥 استفاده از همان منطق آپلود
            const data = await req.file();

            if (!data) {
                throw new BadRequestException('فایل یافت نشد');
            }

            const fields = data.fields || {};

            // 🔥 دیباگ fields
            console.log('🔍 Fields in replace:', fields);
            console.log('🔍 Field keys:', Object.keys(fields));

            // بررسی فایل یوزیج
            if (!fields.file_usage?.value) {
                console.error('❌ file_usage not found in fields. Available fields:', Object.keys(fields));
                throw new BadRequestException('فیلد file_usage الزامی است');
            }

            const uploadDto: UploadFileDto = {
                file_usage: fields.file_usage.value as FileUsage,
                description: fields.description?.value || undefined,
                maxWidth: fields.maxWidth?.value ? parseInt(fields.maxWidth.value) : undefined,
                maxHeight: fields.maxHeight?.value ? parseInt(fields.maxHeight.value) : undefined,
                maxSizeKB: fields.maxSizeKB?.value ? parseInt(fields.maxSizeKB.value) : undefined,
                product_id: fields.product_id?.value || undefined,
                account_id: fields.account_id?.value || undefined,
            };

            console.log('🔍 Upload DTO in replace:', uploadDto);

            const file = {
                fieldname: data.fieldname,
                originalname: data.filename,
                encoding: data.encoding,
                mimetype: data.mimetype,
                buffer: await data.toBuffer(),
                size: (await data.toBuffer()).length,
            };

            return this.fileService.replaceFile(id, file, uploadDto, req.user.id);

        } catch (error) {
            console.error('📌 Replace file controller error:', error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new BadRequestException(
                error.message || 'خطا در جایگزینی فایل'
            );
        }
    }


    @Get('download/:id')
    @ApiOperation({ summary: 'دانلود فایل' })
    async downloadFile(
        @Param('id') id: string,
        @Req() req,
        @Res({ passthrough: true }) res: Response
    ) {
        const { stream, filename, mimeType } = await this.fileService.downloadFile(id, req.user);

        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${filename}"`,
        });

        return stream;
    }

    @Get('stream/:id')
    @ApiOperation({ summary: 'استریم فایل (برای ویدئو/صوت)' })
    @Header('Accept-Ranges', 'bytes')
    async streamFile(
        @Param('id') id: string,
        @Req() req,
        @Res({ passthrough: true }) res: Response,
        @Query('range') range?: string,
    ) {
        const result = await this.fileService.streamFile(id, req.user, range);

        if (result.headers) {
            Object.entries(result.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
        }

        return result.stream;
    }

    @Get('thumbnail/:id')
    @ApiOperation({ summary: 'دریافت thumbnail فایل' })
    async getThumbnail(
        @Param('id') id: string,
        @Req() req,
        @Res({ passthrough: true }) res: Response
    ) {
        const stream = await this.fileService.getThumbnail(id, req.user);

        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
        });

        return stream;
    }

    @Put(':id')
    @ApiOperation({ summary: 'ویرایش مشخصات فایل' })
    async updateFile(
        @Param('id') id: string,
        @Body() updateDto: UpdateFileDto,
        @Req() req,
    ) {
        return this.fileService.updateFile(id, updateDto, req.user);
    }

    // در file.controller.ts
    @Delete(':id')
    @ApiOperation({ summary: 'حذف فایل' })
    async deleteFile(@Param('id') id: string, @Req() req) {
        console.log('🔍 User object:', req.user); // برای دیباگ
        console.log('🔍 User ID:', req.user.id); // برای دیباگ

        // ✅ اصلاح: پاس دادن userId به صورت string
        return this.fileService.deleteFile(id, req.user.id);
    }

    @Get('my-files')
    @ApiOperation({ summary: 'دریافت لیست فایل‌های کاربر جاری' })
    async getUserFiles(
        @Req() req,
        @Query('file_usage') file_usage?: FileUsage,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
    ) {
        return this.fileService.getUserFiles(req.user.id, { file_usage, page, limit });
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات فایل' })
    async getFile(@Param('id') id: string, @Req() req) {
        return this.fileService.getFile(id, req.user);
    }
}