// src/categories/categories.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoriesService } from './categories.service';
import { CategoriesAdminController } from './categories-admin.controller';
import { CategoriesPublicController } from './categories-public.controller';
import { AccountUserActivityModule } from '../account-user-activity/account-user-activity.module';
import {UserBehaviorModule} from "../ account-user-behavior/user-behavior.module";
import {CategoriesUserController} from "./categories-user.controller.ts";



@Module({
    imports: [
        PrismaModule,
        UserBehaviorModule,
        AccountUserActivityModule,
    ],
    controllers: [
        CategoriesUserController,
        CategoriesAdminController,
        CategoriesPublicController
    ],
    providers: [CategoriesService],
    exports: [CategoriesService],
})
export class CategoriesModule {}