// src/file/utils/file-upload.util.ts
export const FILE_CONFIG = {
    ALLOWED_MIME_TYPES: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'video/mp4',
        'video/webm',
        'video/ogg',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav'
    ] as string[], // حتماً as string[] اضافه شود

    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

    UPLOAD_DIR: 'uploads'
};

