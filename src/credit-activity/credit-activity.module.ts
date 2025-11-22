// src/credit-activity/credit-activity.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditActivityController } from './credit-activity.controller';
import { CreditActivityAdminController } from './credit-activity-admin.controller';
import { CreditActivityService } from './credit-activity.service';
import { I18nModule } from '../i18n/i18n.module';

@Module({
    imports: [
        PrismaModule,
        I18nModule, // اضافه کردن I18nModule
    ],
    controllers: [
        CreditActivityController,
        CreditActivityAdminController
    ],
    providers: [CreditActivityService],
    exports: [CreditActivityService],
})
export class CreditActivityModule {}