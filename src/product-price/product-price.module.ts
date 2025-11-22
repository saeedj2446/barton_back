// src/product-price/product-price.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ProductPriceService } from './product-price.service';
import { ProductPriceController } from './product-price.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
    imports: [
        PrismaModule,
        I18nModule,
        CacheModule.register(),
    ],
    controllers: [ProductPriceController],
    providers: [ProductPriceService],
    exports: [ProductPriceService],
})
export class ProductPriceModule {}