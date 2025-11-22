import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AccountUserActivityService } from './account-user-activity.service';
import { AccountUserActivityController } from './account-user-activity.controller';
import { AccountUserActivityAdminController } from './account-user-activity.admin.controller';
import { AccountUserActivityProcessor } from './account-user-activity.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [
        PrismaModule,
        BullModule.registerQueue({
            name: 'activity-queue',
            defaultJobOptions: {
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            },
        }),
    ],
    controllers: [
        AccountUserActivityController,
        AccountUserActivityAdminController,
    ],
    providers: [
        AccountUserActivityService,
        AccountUserActivityProcessor,
    ],
    exports: [
        AccountUserActivityService,
    ],
})
export class AccountUserActivityModule {}