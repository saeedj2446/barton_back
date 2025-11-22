// src/user-behavior/user-behavior.module.ts
import { Module } from '@nestjs/common';
import { UserBehaviorService } from './user-behavior.service';
import { UserBehaviorController } from './user-behavior.controller';
import { UserBehaviorAdminController } from './user-behavior.admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
    imports: [
        PrismaModule,
        I18nModule,
    ],
    controllers: [UserBehaviorController, UserBehaviorAdminController],
    providers: [UserBehaviorService],
    exports: [UserBehaviorService],
})
export class UserBehaviorModule {}