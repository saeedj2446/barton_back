import { Module } from '@nestjs/common';
import { MarketAnalyticsService } from './market-analytics.service';
import { MarketAnalyticsController } from './market-analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [MarketAnalyticsController],
    providers: [MarketAnalyticsService],
    exports: [MarketAnalyticsService], // برای استفاده در ماژول‌های دیگر
})
export class MarketAnalyticsModule {}