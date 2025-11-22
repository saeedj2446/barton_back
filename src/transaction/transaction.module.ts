import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionUserController } from './transaction.controller.user';
import { TransactionAdminController } from './transaction.controller.admin';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
    imports: [
        PrismaModule,
        PaymentModule, // ✅ import PaymentModule برای استفاده از PaymentService
    ],
    controllers: [TransactionUserController, TransactionAdminController],
    providers: [TransactionService],
    exports: [TransactionService],
})
export class TransactionModule {}