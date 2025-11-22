// src/modules/order/order.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '@nestjs/cache-manager';
import {OrderUserController} from "./order.current.user.controller";
import {OrderAdminController} from "./order.controller.admin";
import {OrderService} from "./order.service";

@Module({
    imports: [
        PrismaModule,
        CacheModule.register(), // اگر از کش استفاده می‌کنید
    ],
    controllers: [OrderUserController, OrderAdminController],
    providers: [OrderService],
    exports: [OrderService],
})
export class OrderModule {}