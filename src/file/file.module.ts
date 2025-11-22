// src/file/file.module.ts
import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { FileAdminController } from './file-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import {FilePublicController} from "./file.controller.public";

@Module({
    imports: [
        PrismaModule,
    ],
    controllers: [FileController, FileAdminController,FilePublicController],
    providers: [FileService],
    exports: [FileService],
})
export class FileModule {}