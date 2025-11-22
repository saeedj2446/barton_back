// src/file/dto/file-response.dto.ts
import { FileUsage } from '@prisma/client';

export class FileResponseDto {
    id: string;
    file_path: string;
    thumbnail_path?: string;
    file_usage: FileUsage;
    description?: string;
    created_at: Date;
    file_size: number;
    mime_type: string;
    download_url: string;
    thumbnail_url?: string;
}