// src/offers/offers.module.ts
import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { PrismaModule } from '../prisma/prisma.module';
import {OffersCurrentUserController} from "./offers.current.user.controller";
import {OffersAdminController} from "./offers-admin.controller";
import {OffersPublicController} from "./public-offers.controller";
import {OffersManagementByBuyersController} from "./offers.management.by.buyers.controller";

@Module({
    imports: [PrismaModule],
    controllers: [
        OffersCurrentUserController,
        OffersManagementByBuyersController,
        OffersAdminController,
        OffersPublicController,
    ],
    providers: [OffersService],
    exports: [OffersService],
})
export class OffersModule {}