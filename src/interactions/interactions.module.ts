// src/interactions/interactions.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InteractionsService } from './interactions.service';
import { UserInteractionsController } from './user-interactions.controller';
import { PublicInteractionsController } from './public-interactions.controller';
import { AdminInteractionsController } from './admin-interactions.controller';

@Module({
    imports: [PrismaModule],
    controllers: [
        UserInteractionsController,
        PublicInteractionsController,
        AdminInteractionsController
    ],
    providers: [InteractionsService],
    exports: [InteractionsService]
})
export class InteractionsModule {}