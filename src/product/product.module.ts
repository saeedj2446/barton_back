// src/product/product.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../prisma/prisma.module';
import { FileModule } from '../file/file.module';
import { AccountUserActivityModule } from '../account-user-activity/account-user-activity.module';
import { ExcelService } from '../common/services/excel-service';
import { I18nModule } from '../i18n/i18n.module';
import { BoostCleanupTask } from './tasks/boost-cleanup.task';
import { ProductCurrentUserController } from "./product.current.user.controller";
import { ProductAdminController } from "./product-admin.controller";
import { ProductPublicController } from "./public-products.controller";
import { ProductBaseService } from "./service/product.base.service";
import { ProductAdminService } from "./service/product.admin.service";
import { ProductPublicService } from "./service/product.public.service";
import { ProductPricesssssssService } from "./service/product.pricesssssss.service";
import { ProductPersonalizationService } from "./service/product.Personalization.service";
import {UserBehaviorModule} from "../ account-user-behavior/user-behavior.module";

@Module({
    imports: [
        PrismaModule,
        FileModule,
        UserBehaviorModule,
        AccountUserActivityModule,
        I18nModule,
        CacheModule.register()
    ],
    controllers: [
        ProductCurrentUserController,
        ProductAdminController,
        ProductPublicController
    ],
    providers: [
        // ترتیب مهم است
        ProductBaseService,
        ProductPricesssssssService,
        ProductAdminService,
        ProductPublicService,
        ProductPersonalizationService,
        ExcelService,
        BoostCleanupTask
    ],
    exports: [
        ProductBaseService,
        ProductPublicService,
        ProductPricesssssssService
    ],
})
export class ProductModule {}