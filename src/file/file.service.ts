// src/file/file.service.ts
import {
    Injectable,
    StreamableFile,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFileDto } from './dto/create-file.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileUsage, SystemRole, Language } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sharp from 'sharp';
import { createReadStream, existsSync } from 'fs';
import { statSync } from 'fs';
import { FILE_CONFIG } from "./utils/file-upload.util";
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nBadRequestException,
    I18nForbiddenException,
    I18nInternalServerErrorException
} from '../common/exceptions/i18n-exceptions';

const ALLOWED_MIME_TYPES = FILE_CONFIG.ALLOWED_MIME_TYPES;
const MAX_FILE_SIZE = FILE_CONFIG.MAX_FILE_SIZE;
interface FastifyFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}
@Injectable()
export class FileService {
    private readonly baseUploadDir = path.join(process.cwd(), 'uploads');
    private readonly DEFAULT_LANGUAGE = Language.fa;

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {
        this.init();
    }

    private async init() {
        await fs.mkdir(this.baseUploadDir, { recursive: true });
    }

    private getUserUploadDir(userId: string): string {
        return path.join(this.baseUploadDir, userId);
    }

    private getUserThumbnailsDir(userId: string): string {
        return path.join(this.getUserUploadDir(userId), 'thumbnails');
    }

    private async ensureUserDirs(userId: string): Promise<{ uploadDir: string; thumbnailsDir: string }> {
        const uploadDir = this.getUserUploadDir(userId);
        const thumbnailsDir = this.getUserThumbnailsDir(userId);

        await fs.mkdir(uploadDir, { recursive: true });
        await fs.mkdir(thumbnailsDir, { recursive: true });

        return { uploadDir, thumbnailsDir };
    }

    private async isAdmin(userId: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { system_role: true }
        });
        return user?.system_role === SystemRole.ADMIN;
    }

    private isFileOwner(file: any, userId: string): boolean {
        return file.user_id === userId;
    }

    async uploadFile(file: any, uploadDto: UploadFileDto, userId: string, language: Language = this.DEFAULT_LANGUAGE) {

        console.log('🔍 DEBUG: uploadFile called with:', {
            hasFile: !!file,
            uploadDto: uploadDto,
            userId: userId,
            file_usage: uploadDto.file_usage // این خط مهم است
        });

        await this.validateFile(file, uploadDto, language);

        const { uploadDir, thumbnailsDir } = await this.ensureUserDirs(userId);

        const fileId = this.generateFileId();
        const fileExt = path.extname(file.originalname);
        const fileName = `${fileId}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);

        try {
            await fs.writeFile(filePath, file.buffer);

            let thumbnailPath: string | undefined;
            if (this.isImage(file.mimetype)) {
                thumbnailPath = await this.processImage(filePath, uploadDto, thumbnailsDir);
            }

            const createFileData: CreateFileDto = {
                file_path: path.join(userId, fileName),
                thumbnail_path: thumbnailPath ? path.relative(this.baseUploadDir, thumbnailPath) : undefined,
                file_usage: uploadDto.file_usage,
                description: uploadDto.description,
                product_id: uploadDto.product_id && uploadDto.product_id.length === 24 ? uploadDto.product_id : undefined,
                account_id: uploadDto.account_id && uploadDto.account_id.length === 24 ? uploadDto.account_id : undefined,
                user_id: userId,
            };

            const fileRecord = await this.createFile(createFileData, language);
            return this.toResponse(fileRecord, language);

        } catch (error) {
            // 🔥 لاگ خطا
            console.error('📌 FileService upload error:', error);

            // حذف فایل فیزیکی در صورت خطا (اگر ایجاد شده)
            try {
                if (filePath) {
                    await this.deletePhysicalFile(filePath);
                }
            } catch (deleteError) {
                console.warn('⚠️ Could not delete physical file:', deleteError);
            }

            // اگر خطا از نوع I18nException است، همان را پرتاب کن
            if (error instanceof I18nBadRequestException ||
                error instanceof I18nNotFoundException ||
                error instanceof I18nInternalServerErrorException) {
                throw error;
            }

            // برای خطاهای دیگر
            throw new I18nInternalServerErrorException('FILE_UPLOAD_ERROR', language);
        }
    }

    async replaceFile(
        existingFileId: string,
        newFile: any,
        uploadDto: UploadFileDto,
        userId: string,
        language: Language = this.DEFAULT_LANGUAGE
    ) {


        console.log('🔍 DEBUG: replaceFile called with:', {
            existingFileId,
            hasNewFile: !!newFile,
            uploadDto,
            userId,
            file_usage: uploadDto.file_usage // این خط مهم است
        });

        // 1. پیدا کردن فایل موجود و بررسی دسترسی
        const existingFile = await this.prisma.file.findUnique({
            where: { id: existingFileId }
        });

        if (!existingFile) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        // 2. فقط مالک فایل می‌تواند جایگزینی کند
        if (!this.isFileOwner(existingFile, userId)) {
            throw new I18nForbiddenException('FILE_ACCESS_DENIED', language);
        }

        // 3. اعتبارسنجی فایل جدید
        await this.validateFile(newFile, uploadDto, language);

        const { uploadDir, thumbnailsDir } = await this.ensureUserDirs(userId);

        // 4. ایجاد فایل جدید
        const fileId = this.generateFileId();
        const fileExt = path.extname(newFile.originalname);
        const fileName = `${fileId}${fileExt}`;
        const newFilePath = path.join(uploadDir, fileName);

        // 5. ذخیره مسیرهای فایل قدیمی برای حذف بعدی
        const oldFilePath = path.join(this.baseUploadDir, existingFile.file_path);
        const oldThumbnailPath = existingFile.thumbnail_path
            ? path.join(this.baseUploadDir, existingFile.thumbnail_path)
            : undefined;

        // 6. تعریف متغیر thumbnail در scope اصلی
        let newThumbnailPath: string | undefined;

        try {
            // 7. ذخیره فایل جدید
            await fs.writeFile(newFilePath, newFile.buffer);

            // 8. پردازش thumbnail اگر فایل تصویر است
            if (this.isImage(newFile.mimetype)) {
                newThumbnailPath = await this.processImage(newFilePath, uploadDto, thumbnailsDir);
            }

            // 9. آپدیت رکورد موجود در دیتابیس
            const updatedFile = await this.prisma.file.update({
                where: { id: existingFileId },
                data: {
                    file_path: path.join(userId, fileName),
                    thumbnail_path: newThumbnailPath ? path.relative(this.baseUploadDir, newThumbnailPath) : undefined,
                    file_usage: uploadDto.file_usage,
                    description: uploadDto.description,
                    product_id: uploadDto.product_id && uploadDto.product_id.length === 24 ? uploadDto.product_id : undefined,
                    account_id: uploadDto.account_id && uploadDto.account_id.length === 24 ? uploadDto.account_id : undefined,
                },
            });

            // 10. حذف فایل‌های فیزیکی قدیمی
             this.deleteOldPhysicalFiles(oldFilePath, oldThumbnailPath);

            console.log('✅ File replaced successfully:', existingFileId);
            return this.toResponse(updatedFile, language);

        } catch (error) {

            // 11. مدیریت خطا - حذف فایل جدید در صورت خطا
            console.error('📌 FileService replace error:', error);


            try {
                // حذف فایل جدیدی که ایجاد شده
                if (newFilePath) {
                    await this.deletePhysicalFile(newFilePath);
                }
                // حذف thumbnail جدید اگر ایجاد شده - حالا newThumbnailPath در scope است
                if (newThumbnailPath && await this.fileExists(newThumbnailPath)) {
                    await this.deletePhysicalFile(newThumbnailPath);
                }
            } catch (deleteError) {
                console.warn('⚠️ Could not delete new files after error:', deleteError);
            }

            if (error instanceof I18nBadRequestException ||
                error instanceof I18nNotFoundException ||
                error instanceof I18nInternalServerErrorException) {
                throw error;
            }

            throw new I18nInternalServerErrorException('FILE_REPLACE_ERROR', language);
        }
    }

// متد کمکی برای حذف فایل‌های فیزیکی قدیمی
    private async deleteOldPhysicalFiles(mainFilePath: string, thumbnailPath?: string) {
        const filesToDelete: string[] = [mainFilePath];
        if (thumbnailPath) filesToDelete.push(thumbnailPath);

        console.log('🔍 Attempting to delete old files...');

        for (const filePath of filesToDelete) {
            try {
                if (await this.fileExists(filePath)) {
                    await this.forceDeleteWithRetry(filePath);
                    console.log('✅ Old file deleted:', filePath);
                }
            } catch (error) {
                // 🔥 حتی اگر force delete هم شکست خورد، ادامه بده
                console.warn('⚠️ Could not delete old file (even with force):', filePath, error);
                // ❌ خطا را throw نکنید - اجازه دهید فرآیند اصلی ادامه یابد
            }
        }
    }

    private async forceDeleteWithRetry(filePath: string, maxRetries: number = 5): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // اول سعی کنید با fs.unlink معمولی
                await fs.unlink(filePath);
                console.log('✅ File deleted normally:', filePath);
                return;
            } catch (error: any) {
                if (error.code === 'EPERM' || error.code === 'EBUSY') {
                    console.log(`🔄 Attempt ${attempt}/${maxRetries} - File locked, using force methods...`);

                    // صبر کردن بین تلاش‌ها
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }

                    // در آخرین تلاش از روش‌های force استفاده کنید
                    if (attempt === maxRetries) {
                        try {
                            // استفاده از command line
                            await this.forceDeleteWithCMD(filePath);
                            return;
                        } catch (cmdError) {
                            console.error('❌ All force methods failed for:', filePath);
                            throw cmdError; // این خطا در متد اصلی catch می‌شود
                        }
                    }
                } else {
                    // خطای دیگر
                    throw error;
                }
            }
        }
    }

    private async forceDeleteWithCMD(filePath: string): Promise<void> {
        const commands = [
            `del /f /q "${filePath}"`,           // CMD force delete
            `powershell -Command "Remove-Item -Force -Path '${filePath}'"`,  // PowerShell
        ];

        for (const command of commands) {
            try {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);

                await execAsync(command);
                console.log('✅ Force deleted with command:', filePath);
                return;
            } catch (error) {
                console.warn(`⚠️ Command failed: ${command}`, error);
                continue;
            }
        }

        throw new Error('All force delete methods failed');
    }



    async uploadFileForUser(file: FastifyFile, uploadDto: UploadFileDto & { target_user_id: string }, adminUserId: string, language: Language = this.DEFAULT_LANGUAGE) {
        if (!await this.isAdmin(adminUserId)) {
            throw new I18nForbiddenException('ACCESS_DENIED', language);
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: uploadDto.target_user_id }
        });

        if (!targetUser) {
            throw new I18nNotFoundException('TARGET_USER_NOT_FOUND', language);
        }

        await this.validateFile(file, uploadDto, language);

        const { uploadDir, thumbnailsDir } = await this.ensureUserDirs(uploadDto.target_user_id);

        const fileId = this.generateFileId();
        const fileExt = path.extname(file.originalname);
        const fileName = `${fileId}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);

        try {
            await fs.writeFile(filePath, file.buffer);

            let thumbnailPath: string | undefined;
            if (this.isImage(file.mimetype)) {
                thumbnailPath = await this.processImage(filePath, uploadDto, thumbnailsDir);
            }

            const fileRecord = await this.createFile({
                file_path: path.join(uploadDto.target_user_id, fileName),
                thumbnail_path: thumbnailPath ? path.relative(this.baseUploadDir, thumbnailPath) : undefined,
                file_usage: uploadDto.file_usage,
                description: uploadDto.description,
                product_id: uploadDto.product_id,
                account_id: uploadDto.account_id,
                user_id: uploadDto.target_user_id,
            }, language);

            return this.toResponse(fileRecord, language);

        } catch (error) {
            await this.deletePhysicalFile(filePath);
            throw new I18nInternalServerErrorException('FILE_UPLOAD_ERROR', language);
        }
    }

    async getFile(fileId: string, userId?: string, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.prisma.file.findUnique({
            where: { id: fileId },
            include: {
                user: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { first_name: true, last_name: true }
                        }
                    }
                },
                product: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        },
                        user_id: true
                    }
                },
                account: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        },
                        account_users: { select: { user_id: true } }
                    }
                },
            },
        });

        if (!file) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        if (!await this.canAccessFile(file, userId, language)) {
            throw new I18nForbiddenException('FILE_ACCESS_DENIED', language);
        }

        return this.toResponse(file, language);
    }

    async downloadFile(fileId: string, userId?: string, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.getFile(fileId, userId, language);
        const filePath = path.join(this.baseUploadDir, file.file_path);

        if (!await this.fileExists(filePath)) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        await this.incrementDownloadCount(fileId);

        const fileStream = createReadStream(filePath);

        return {
            stream: new StreamableFile(fileStream),
            filename: file.description || `file_${file.id}${path.extname(file.file_path)}`,
            mimeType: this.getMimeType(file.file_path),
        };
    }

    async streamFile(fileId: string, userId?: string, range?: string, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.getFile(fileId, userId, language);
        const filePath = path.join(this.baseUploadDir, file.file_path);

        if (!await this.fileExists(filePath)) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        const fileStat = statSync(filePath);
        const fileSize = fileStat.size;
        const mimeType = this.getMimeType(file.file_path);

        if (range && this.isMediaFile(mimeType)) {
            return this.handleRangeRequest(filePath, range, fileSize, mimeType);
        }

        const fileStream = createReadStream(filePath);

        return {
            stream: new StreamableFile(fileStream),
            headers: {
                'Content-Type': mimeType,
                'Content-Length': fileSize,
            }
        };
    }

    async getThumbnail(fileId: string, userId?: string, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.getFile(fileId, userId, language);

        if (!file.thumbnail_path) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        const thumbPath = path.join(this.baseUploadDir, file.thumbnail_path);

        if (!await this.fileExists(thumbPath)) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        const thumbStream = createReadStream(thumbPath);
        return new StreamableFile(thumbStream);
    }

    async updateFile(fileId: string, updateData: { description?: string }, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });

        if (!file) throw new I18nNotFoundException('FILE_NOT_FOUND', language);

        const isOwner = this.isFileOwner(file, userId);
        const isAdmin = await this.isAdmin(userId);

        if (!isOwner && !isAdmin) {
            throw new I18nForbiddenException('FILE_ACCESS_DENIED', language);
        }

        const updatedFile = await this.prisma.file.update({
            where: { id: fileId },
            data: { description: updateData.description },
        });

        return this.toResponse(updatedFile, language);
    }

    // در file.service.ts - متد deleteFile
    async deleteFile(fileId: string, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        console.log('🔍 Deleting file:', fileId);
        console.log('🔍 User ID:', userId);
        console.log('🔍 User ID type:', typeof userId);

        const file = await this.prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        // ✅ اطمینان از string بودن userId
        const userStringId = String(userId);

        const isOwner = this.isFileOwner(file, userStringId);
        const isAdmin = await this.isAdmin(userStringId);

        if (!isOwner && !isAdmin) {
            throw new I18nForbiddenException('FILE_ACCESS_DENIED', language);
        }

        try {
            await this.deletePhysicalFile(file);
            await this.prisma.file.delete({ where: { id: fileId } });

            return {
                message: this.i18nService.t('File_DELETED_SUCCESS', language),
                file_id: fileId,
            };
        } catch (error) {
            console.error('❌ Delete file error:', error);
            throw new I18nInternalServerErrorException('FILE_DELETE_ERROR', language);
        }
    }

    async getUserFiles(userId: string, filters?: {
        file_usage?: FileUsage;
        page?: number;
        limit?: number;
    }, language: Language = this.DEFAULT_LANGUAGE) {
        const { file_usage, page = 1, limit = 20 } = filters || {};
        const skip = (page - 1) * limit;

        const where: any = { user_id: userId };
        if (file_usage) where.file_usage = file_usage;

        const [files, total] = await Promise.all([
            this.prisma.file.findMany({
                where, skip, take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    product: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { name: true }
                            }
                        }
                    },
                    account: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { name: true }
                            }
                        }
                    },
                },
            }),
            this.prisma.file.count({ where }),
        ]);

        return {
            data: files.map(file => this.toResponse(file, language)),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getAllFiles(filters: {
        page: number;
        limit: number;
        file_usage?: FileUsage;
        user_id?: string;
        account_id?: string;
        product_id?: string;
        search?: string;
        start_date?: Date;
        end_date?: Date;
    }, language: Language = this.DEFAULT_LANGUAGE) {
        const { page, limit, file_usage, user_id, account_id, product_id, search, start_date, end_date } = filters;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (file_usage) where.file_usage = file_usage;
        if (user_id) where.user_id = user_id;
        if (account_id) where.account_id = account_id;
        if (product_id) where.product_id = product_id;

        if (start_date || end_date) {
            where.created_at = {};
            if (start_date) where.created_at.gte = start_date;
            if (end_date) where.created_at.lte = end_date;
        }

        if (search) {
            where.OR = [
                { description: { contains: search, mode: 'insensitive' } },
                { file_path: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [files, total] = await Promise.all([
            this.prisma.file.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            },
                            mobile: true,
                            email: true,
                            system_role: true,
                        }
                    },
                    account: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { name: true }
                            },
                            activity_type: true
                        }
                    },
                    product: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { name: true }
                            },
                            status: true
                        }
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.file.count({ where }),
        ]);

        return {
            data: files.map(file => this.toAdminResponse(file, language)),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getFileDetails(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.prisma.file.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { first_name: true, last_name: true }
                        },
                        mobile: true,
                        email: true,
                        system_role: true,
                        created_at: true
                    }
                },
                account: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        },
                        activity_type: true,
                        is_active: true,
                        confirmed: true,
                        account_users: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        contents: {
                                            where: { language },
                                            select: { first_name: true, last_name: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                product: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        },
                        status: true,
                        user: {
                            select: {
                                id: true,
                                contents: {
                                    where: { language },
                                    select: { first_name: true, last_name: true }
                                }
                            }
                        }
                    }
                },
            },
        });

        if (!file) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        return this.toAdminResponse(file, language);
    }

    async getAccountFiles(accountId: string, filters?: {
        file_usage?: FileUsage;
        page?: number;
        limit?: number;
    }, language: Language = this.DEFAULT_LANGUAGE) {
        const { file_usage, page = 1, limit = 20 } = filters || {};
        const skip = (page - 1) * limit;

        const where: any = { account_id: accountId };
        if (file_usage) where.file_usage = file_usage;

        // include کردن contents در کوئری account
        const account = await this.prisma.account.findUnique({
            where: { id: accountId },
            include: {
                contents: {
                    where: { language },
                    select: { name: true, company_name: true, language: true }
                }
            }
        });

        if (!account) {
            throw new I18nNotFoundException('ACCOUNT_NOT_FOUND', language);
        }

        const accountContent = account.contents?.find((c: any) => c.language === language) || account.contents?.[0];

        const [files, total] = await Promise.all([
            this.prisma.file.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    product: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { name: true }
                            }
                        }
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.file.count({ where }),
        ]);

        return {
            data: files.map(file => this.toResponse(file, language)),
            account_info: {
                id: account.id,
                name: accountContent?.name || accountContent?.company_name,
                activity_type: account.activity_type,
            },
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getProductFiles(productId: string, filters?: {
        file_usage?: FileUsage;
        page?: number;
        limit?: number;
    }, language: Language = this.DEFAULT_LANGUAGE) {
        const { file_usage, page = 1, limit = 20 } = filters || {};
        const skip = (page - 1) * limit;

        const where: any = { product_id: productId };
        if (file_usage) where.file_usage = file_usage;

        // ✅ include کردن contents
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: {
                contents: {
                    where: { language },
                    select: { name: true, language: true }
                }
            }
        });

        if (!product) {
            throw new I18nNotFoundException('PRODUCT_NOT_FOUND', language);
        }

        const productContent = product.contents?.find((c: any) => c.language === language) || product.contents?.[0];

        const [files, total] = await Promise.all([
            this.prisma.file.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.file.count({ where }),
        ]);

        return {
            data: files.map(file => this.toResponse(file, language)),
            product_info: {
                id: product.id,
                name: productContent?.name,
                status: product.status,
            },
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async adminUpdateFile(id: string, updateData: { description?: string }, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.prisma.file.findUnique({ where: { id } });

        if (!file) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        const updatedFile = await this.prisma.file.update({
            where: { id },
            data: updateData,
        });

        return this.toAdminResponse(updatedFile, language);
    }

    async adminDeleteFile(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const file = await this.prisma.file.findUnique({ where: { id } });

        if (!file) {
            throw new I18nNotFoundException('FILE_NOT_FOUND', language);
        }

        try {
            await this.deletePhysicalFile(file);
            await this.prisma.file.delete({ where: { id } });

            return {
                message: this.i18nService.t('ACTIVITY_DELETED_SUCCESS', language),
                file_id: id,
            };
        } catch (error) {
            throw new I18nInternalServerErrorException('FILE_DELETE_ERROR', language);
        }
    }

    async bulkDeleteFiles(fileIds: string[], language: Language = this.DEFAULT_LANGUAGE) {
        if (!fileIds || fileIds.length === 0) {
            throw new I18nBadRequestException('INVALID_DATA', language);
        }

        if (fileIds.length > 100) {
            throw new I18nBadRequestException('INVALID_DATA', language, { message: 'حداکثر 100 فایل می‌تواند حذف شود' });
        }

        const files = await this.prisma.file.findMany({
            where: { id: { in: fileIds } },
        });

        const foundIds = files.map(file => file.id);
        const notFoundIds = fileIds.filter(id => !foundIds.includes(id));

        for (const file of files) {
            await this.deletePhysicalFile(file);
        }

        const deleteResult = await this.prisma.file.deleteMany({
            where: { id: { in: foundIds } },
        });

        return {
            deleted_count: deleteResult.count,
            not_found_ids: notFoundIds,
            message: this.i18nService.t('USER_ACTIVITIES_DELETED_SUCCESS', language, { count: deleteResult.count }),
        };
    }

    async getFilesStats(language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const [
                totalFiles,
                totalSize,
                filesByUsage,
                recentUploads,
                usersWithFiles,
                accountsWithFiles,
            ] = await Promise.all([
                this.prisma.file.count(),
                this.getTotalStorageSize(),
                this.prisma.file.groupBy({
                    by: ['file_usage'],
                    _count: { id: true },
                }),
                this.prisma.file.count({
                    where: { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                }),
                this.prisma.user.count({ where: { files: { some: {} } } }),
                this.prisma.account.count({ where: { files: { some: {} } } }),
            ]);

            return {
                total_files: totalFiles,
                total_size: totalSize,
                recent_uploads_24h: recentUploads,
                users_with_files: usersWithFiles,
                accounts_with_files: accountsWithFiles,
                usage_breakdown: filesByUsage.map(item => ({
                    file_usage: item.file_usage,
                    count: item._count.id,
                })),
            };
        } catch (error) {
            throw new I18nInternalServerErrorException('FILE_STATS_ERROR', language);
        }
    }

    async getStorageUsage(language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const totalFiles = await this.prisma.file.count();
            let totalPhysicalSize = 0;

            const files = await this.prisma.file.findMany({
                select: { file_path: true, thumbnail_path: true }
            });

            for (const file of files) {
                const mainFilePath = path.join(this.baseUploadDir, file.file_path);
                if (existsSync(mainFilePath)) {
                    const stats = await fs.stat(mainFilePath);
                    totalPhysicalSize += stats.size;
                }

                if (file.thumbnail_path) {
                    const thumbPath = path.join(this.baseUploadDir, file.thumbnail_path);
                    if (existsSync(thumbPath)) {
                        const thumbStats = await fs.stat(thumbPath);
                        totalPhysicalSize += thumbStats.size;
                    }
                }
            }

            return {
                total_files: totalFiles,
                total_size: totalPhysicalSize,
                total_size_mb: Math.round(totalPhysicalSize / (1024 * 1024)),
                total_size_gb: Math.round((totalPhysicalSize / (1024 * 1024 * 1024)) * 100) / 100,
            };
        } catch (error) {
            throw new I18nInternalServerErrorException('FILE_STATS_ERROR', language);
        }
    }

    async cleanupOrphanedFiles(language: Language = this.DEFAULT_LANGUAGE) {
        try {
            const dbFiles = await this.prisma.file.findMany({
                select: { file_path: true, thumbnail_path: true }
            });

            const dbFilePaths = new Set();
            dbFiles.forEach(file => {
                dbFilePaths.add(file.file_path);
                if (file.thumbnail_path) {
                    dbFilePaths.add(file.thumbnail_path);
                }
            });

            const physicalFiles = await this.getAllPhysicalFiles(this.baseUploadDir);
            const orphanedFiles = [];

            for (const physicalFile of physicalFiles) {
                const relativePath = path.relative(this.baseUploadDir, physicalFile);

                if (!dbFilePaths.has(relativePath)) {
                    const stats = await fs.stat(physicalFile);
                    orphanedFiles.push({
                        path: relativePath,
                        size: stats.size,
                        created: stats.birthtime
                    });

                    await fs.unlink(physicalFile);
                }
            }

            return {
                cleaned_count: orphanedFiles.length,
                orphaned_files: orphanedFiles,
                message: this.i18nService.t('OLD_ACTIVITIES_CLEANED_SUCCESS', language, {
                    count: orphanedFiles.length,
                    days: 0
                }),
            };
        } catch (error) {
            throw new I18nInternalServerErrorException('FILE_CLEANUP_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    // این interface را در بالای فایل (پایین imports) اضافه کنید


// 🔥 متد validateFile را اصلاح کنید - این متد را جایگزین کنید
private async validateFile(file: FastifyFile, uploadDto: UploadFileDto, language: Language) {
    if (file.size > MAX_FILE_SIZE) {
        throw new I18nBadRequestException('FILE_SIZE_EXCEEDED', language, {
            maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`
        });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new I18nBadRequestException('FILE_TYPE_NOT_ALLOWED', language);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (['.exe', '.bat', '.cmd', '.sh', '.php', '.js'].includes(ext)) {
        throw new I18nBadRequestException('FILE_EXTENSION_NOT_ALLOWED', language);
    }

    if (uploadDto.product_id) {
        const product = await this.prisma.product.findUnique({ where: { id: uploadDto.product_id } });
        if (!product) throw new I18nNotFoundException('PRODUCT_NOT_FOUND', language);
    }

    if (uploadDto.account_id) {
        const account = await this.prisma.account.findUnique({ where: { id: uploadDto.account_id } });
        if (!account) throw new I18nNotFoundException('ACCOUNT_NOT_FOUND', language);
    }
}

    private async processImage(filePath: string, uploadDto: UploadFileDto, thumbnailsDir: string): Promise<string> {
        let processor = sharp(filePath);

        if (uploadDto.maxWidth || uploadDto.maxHeight) {
            processor = processor.resize({
                width: uploadDto.maxWidth,
                height: uploadDto.maxHeight,
                fit: 'inside',
                withoutEnlargement: true,
            });
        }

        if (uploadDto.maxSizeKB) {
            processor = processor.jpeg({ quality: 80 });
        }

        const thumbName = `thumb_${path.basename(filePath)}`;
        const thumbPath = path.join(thumbnailsDir, thumbName);

        await processor.toFile(thumbPath);
        return thumbPath;
    }

    private async createFile(data: CreateFileDto, language: Language) {
        try {
            // await this.cleanupOldFiles(data, language); // 🔥 موقتاً غیرفعال کنید

            return await this.prisma.file.create({ data });
        } catch (error) {
            console.error('📌 Create file DB error:', error);

            // خطاهای خاص Prisma
            if (error.code === 'P2002') {
                throw new I18nBadRequestException('FILE_ALREADY_EXISTS', language);
            } else if (error.code === 'P2003') {
                throw new I18nBadRequestException('RELATED_ENTITY_NOT_FOUND', language);
            } else if (error.code === 'P2023') {
                throw new I18nBadRequestException('INVALID_OBJECT_ID', language);
            }

            throw new I18nInternalServerErrorException('FILE_STORAGE_ERROR', language);
        }
    }

    private async cleanupOldFiles(data: CreateFileDto, language: Language) {
        const where: any = { file_usage: data.file_usage };
        if (data.user_id) where.user_id = data.user_id;
        if (data.product_id) where.product_id = data.product_id;
        if (data.account_id) where.account_id = data.account_id;

        const oldFiles = await this.prisma.file.findMany({ where });

        for (const file of oldFiles) {
            await this.deletePhysicalFile(file);
            await this.prisma.file.delete({ where: { id: file.id } });
        }
    }

    private async canAccessFile(file: any, userId?: string, language?: Language): Promise<boolean> {
        const publicUsages = [
            FileUsage.PROFILE_PHOTO ,FileUsage.PRODUCT_IMAGE, FileUsage.PRODUCT_GALLERY,
            FileUsage.LOGO, FileUsage.BANNER, FileUsage.AD_BANNER
        ];

        if (publicUsages.includes(file.file_usage)) {
            return true;
        }

        if (!userId) return false;
        if (await this.isAdmin(userId)) return true;
        if (this.isFileOwner(file, userId)) return true;
        if (file.product?.user_id === userId) return true;
        if (file.account?.account_users?.some((au: any) => au.user_id === userId)) return true;

        return false;
    }

    private handleRangeRequest(filePath: string, range: string, fileSize: number, mimeType: string) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        const stream = createReadStream(filePath, { start, end });

        return {
            stream: new StreamableFile(stream),
            headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
            }
        };
    }

    private async getTotalStorageSize(): Promise<number> {
        try {
            let totalSize = 0;

            async function calculateDirSize(dirPath: string): Promise<number> {
                let size = 0;
                const items = await fs.readdir(dirPath);

                for (const item of items) {
                    const itemPath = path.join(dirPath, item);
                    const stats = await fs.stat(itemPath);

                    if (stats.isDirectory()) {
                        size += await calculateDirSize(itemPath);
                    } else {
                        size += stats.size;
                    }
                }

                return size;
            }

            totalSize = await calculateDirSize(this.baseUploadDir);
            return totalSize;
        } catch (error) {
            return 0;
        }
    }

    private async getAllPhysicalFiles(dirPath: string): Promise<string[]> {
        const files: string[] = [];

        async function traverseDirectory(currentPath: string) {
            const items = await fs.readdir(currentPath);

            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const stats = await fs.stat(itemPath);

                if (stats.isDirectory()) {
                    await traverseDirectory(itemPath);
                } else {
                    files.push(itemPath);
                }
            }
        }

        await traverseDirectory(dirPath);
        return files;
    }

    private generateFileId(): string {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private isImage(mimetype: string): boolean {
        return mimetype.startsWith('image/');
    }

    private isMediaFile(mimetype: string): boolean {
        return mimetype.startsWith('video/') || mimetype.startsWith('audio/');
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async deletePhysicalFile(fileOrPath: any) {
        try {
            let files: string[] = [];

            // اگر string است (مسیر فایل)
            if (typeof fileOrPath === 'string') {
                files = [fileOrPath];
            }
            // اگر object است و file_path دارد
            else if (fileOrPath && fileOrPath.file_path) {
                files = [path.join(this.baseUploadDir, fileOrPath.file_path)];
                if (fileOrPath.thumbnail_path) {
                    files.push(path.join(this.baseUploadDir, fileOrPath.thumbnail_path));
                }
            }
            // اگر object است ولی file_path ندارد (مستقیم مسیر)
            else if (fileOrPath && typeof fileOrPath === 'object') {
                files = [fileOrPath];
            }
            // اگر نامعتبر است
            else {
                console.warn('Invalid file object for deletion:', fileOrPath);
                return;
            }
            for (const filePath of files) {
                try {
                    if (await this.fileExists(filePath)) {
                        await fs.unlink(filePath);
                        console.log('Deleted file:', filePath);
                    }
                } catch (error) {
                    console.warn('Error deleting file:', filePath, error);
                }
            }
        } catch (error) {
            console.error('Error in deletePhysicalFile:', error);
        }
    }

    private async incrementDownloadCount(fileId: string) {
        const key = `downloads:${fileId}`;
        const count = ((await this.cacheManager.get<number>(key)) || 0) + 1;
        await this.cacheManager.set(key, count, 60 * 60 * 1000);
    }

    private getMimeType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        const mimeMap: { [key: string]: string } = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
            '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
        };
        return mimeMap[ext] || 'application/octet-stream';
    }

    private toResponse(file: any, language: Language) {
        const userContent = file.user?.contents?.[0] || {};
        const productContent = file.product?.contents?.[0] || {};
        const accountContent = file.account?.contents?.[0] || {};

        return {
            id: file.id,
            file_path: file.file_path,
            thumbnail_path: file.thumbnail_path,
            file_usage: file.file_usage,
            description: file.description,
            created_at: file.created_at,
            mime_type: this.getMimeType(file.file_path),
            download_url: `/files/download/${file.id}`,
            stream_url: `/files/stream/${file.id}`,
            thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
            user: file.user ? {
                id: file.user.id,
                name: `${userContent.first_name || ''} ${userContent.last_name || ''}`.trim(),
            } : null,
            product: file.product ? {
                id: file.product.id,
                name: productContent.name || file.product.name,
            } : null,
            account: file.account ? {
                id: file.account.id,
                name: accountContent.name || file.account.name,
            } : null,
        };
    }

    private toAdminResponse(file: any, language: Language) {
        const baseResponse = this.toResponse(file, language);
        const userContent = file.user?.contents?.[0] || {};
        const accountContent = file.account?.contents?.[0] || {};
        const productContent = file.product?.contents?.[0] || {};

        return {
            ...baseResponse,
            user: file.user ? {
                id: file.user.id,
                first_name: userContent.first_name,
                last_name: userContent.last_name,
                mobile: file.user.mobile,
                email: file.user.email,
                system_role: file.user.system_role,
                created_at: file.user.created_at,
            } : null,
            account: file.account ? {
                id: file.account.id,
                name: accountContent.name || file.account.name,
                activity_type: file.account.activity_type,
                is_active: file.account.is_active,
                confirmed: file.account.confirmed,
                account_users: file.account.account_users,
            } : null,
            product: file.product ? {
                id: file.product.id,
                name: productContent.name || file.product.name,
                status: file.product.status,
                user: file.product.user,
            } : null,
            physical_file_exists: this.fileExists(path.join(this.baseUploadDir, file.file_path)),
        };
    }
}