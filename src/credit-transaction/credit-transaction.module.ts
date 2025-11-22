// src/credit-transaction/credit-transaction.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditTransactionController } from "./credit-transaction.controller";
import { CreditTransactionAdminController } from "./credit-transaction-admin.controller";
import { CreditTransactionService } from "./credit-transaction.service";
import { I18nModule } from '../i18n/i18n.module';

@Module({
    imports: [
        PrismaModule,
        I18nModule, // اضافه کردن I18nModule
    ],
    controllers: [
        CreditTransactionController,
        CreditTransactionAdminController
    ],
    providers: [CreditTransactionService],
    exports: [CreditTransactionService],
})
export class CreditTransactionModule {}