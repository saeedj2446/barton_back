// src/buy-ad/buy-ad.module.ts
import { Module } from '@nestjs/common';
import { BuyAdService } from './buy-ad.service';
import { PrismaModule } from '../prisma/prisma.module';
import {BuyAdCurrentUserController} from "./buy-ad.current.user.controller";
import {BuyAdPublicController} from "./public-buy-ad.controller";
import {BuyAdAdminController} from "./buy-ad-admin.controller";

@Module({
    imports: [PrismaModule],
    controllers: [
        BuyAdCurrentUserController,
        BuyAdPublicController,
        BuyAdAdminController,
    ],
    providers: [BuyAdService],
    exports: [BuyAdService],
})
export class BuyAdModule {}