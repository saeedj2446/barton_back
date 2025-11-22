// src/file/file-public.controller.ts
import { Controller, Get, Param, Res, Query, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileService } from './file.service';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Public Files')
@Controller('files/public')
@Public()
export class FilePublicController {
    constructor(private readonly fileService: FileService) {}

    @Get('stream/:id')
    @ApiOperation({ summary: 'استریم فایل عمومی (بدون نیاز به توکن)' })
    @ApiResponse({ status: 200, description: 'فایل با موفقیت استریم شد' })
    @ApiResponse({ status: 404, description: 'فایل یافت نشد' })
    @Header('Accept-Ranges', 'bytes')
    async streamFile(
        @Param('id') id: string,
        @Res({ passthrough: true }) res: Response,
        @Query('range') range?: string,
    ) {
        const result = await this.fileService.streamFile(id, undefined, range);

        if (result.headers) {
            Object.entries(result.headers).forEach(([key, value]) => {
                res.header(key, String(value)); // ✅ تبدیل value به string
            });
        }

        return result.stream;
    }

    @Get('download/:id')
    @ApiOperation({ summary: 'دانلود فایل عمومی (بدون نیاز به توکن)' })
    @ApiResponse({ status: 200, description: 'فایل با موفقیت دانلود شد' })
    @ApiResponse({ status: 404, description: 'فایل یافت نشد' })
    async downloadFile(
        @Param('id') id: string,
        @Res({ passthrough: true }) res: Response
    ) {
        const { stream, filename, mimeType } = await this.fileService.downloadFile(id, undefined);

        res.header('Content-Type', mimeType);
        res.header('Content-Disposition', `inline; filename="${filename}"`);

        return stream;
    }

    @Get('thumbnail/:id')
    @ApiOperation({ summary: 'دریافت thumbnail فایل عمومی' })
    @ApiResponse({ status: 200, description: 'Thumbnail با موفقیت برگردانده شد' })
    @ApiResponse({ status: 404, description: 'فایل یا thumbnail یافت نشد' })
    async getThumbnail(
        @Param('id') id: string,
        @Res({ passthrough: true }) res: Response
    ) {
        const stream = await this.fileService.getThumbnail(id, undefined);

        res.header('Content-Type', 'image/jpeg');
        res.header('Cache-Control', 'public, max-age=86400');

        return stream;
    }

    @Get('info/:id')
    @ApiOperation({ summary: 'دریافت اطلاعات فایل عمومی' })
    @ApiResponse({ status: 200, description: 'اطلاعات فایل با موفقیت برگردانده شد' })
    @ApiResponse({ status: 404, description: 'فایل یافت نشد' })
    async getFileInfo(
        @Param('id') id: string
    ) {
        return this.fileService.getFile(id, undefined);
    }
}