// src/tasks/boost-cleanup.task.ts
//برای خروج اتوماتیک کالا از حالت پله بعد از اریخ انقضا
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {PrismaService} from "../../prisma/prisma.service";


@Injectable()
export class BoostCleanupTask {
    private readonly logger = new Logger(BoostCleanupTask.name);

    constructor(private prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT) // هر روز نصف شب اجرا شود
    async handleExpiredBoosts() {
        this.logger.log('بررسی بوست‌های منقضی شده...');

        const now = new Date();
        const result = await this.prisma.product.updateMany({
            where: {
                boost_purchased: true,
                boost_expires_at: {
                    lt: now
                }
            },
            data: {
                boost_power: 0,
                boost_purchased: false,
                boost_is_elevated: false,
                boost_expires_at: null
            }
        });

        if (result.count > 0) {
            this.logger.log(`${result.count} محصول با بوست منقضی شده غیرفعال شد`);
        }
    }
}