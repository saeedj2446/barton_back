// src/file/interfaces/file-upload-progress.interface.ts
export interface FileUploadProgress {
    fileId: string;
    fileName: string;
    progress: number; // 0-100
    uploadedBytes: number;
    totalBytes: number;
    status: 'uploading' | 'processing' | 'completed' | 'error';
    message?: string;
}