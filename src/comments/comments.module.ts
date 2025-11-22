// src/comments/comments.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommentsService } from './comments.service';
import { UserCommentsController } from './user-comments.controller';
import { PublicCommentsController } from './public-comments.controller';
import { AdminCommentsController } from './admin-comments.controller';

@Module({
    imports: [PrismaModule],
    controllers: [
        UserCommentsController,
        PublicCommentsController,
        AdminCommentsController
    ],
    providers: [CommentsService],
    exports: [CommentsService]
})
export class CommentsModule {}