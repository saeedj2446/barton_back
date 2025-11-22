// src/plan/plan.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditTransactionModule } from '../credit-transaction/credit-transaction.module';
import { CreditActivityModule } from '../credit-activity/credit-activity.module';
import { PlanService } from './plan.service';
import { PlanController } from './plan.controller';
import { PlanAdminController } from './plan-admin.controller';
import { I18nModule } from '../i18n/i18n.module';

@Module({
    imports: [
        PrismaModule,
        CreditTransactionModule,
        CreditActivityModule,
        I18nModule, // اضافه کردن I18nModule
    ],
    controllers: [PlanController, PlanAdminController],
    providers: [PlanService],
    exports: [PlanService],
})
export class PlanModule {}