// src/user/user.module.ts
import { Module } from "@nestjs/common";
import { UserService } from "./user.service";
import { CurrentUserController } from "./current.user.controller";

import { PrismaModule } from "../prisma/prisma.module";
import { CacheModule } from "@nestjs/cache-manager";
import { AccountUserActivityService } from "../account-user-activity/account-user-activity.service";
import {UserBehaviorService} from "../ account-user-behavior/user-behavior.service";
import {UserAdminController} from "./user.controller.admin";
import {UserPublicController} from "./user.controller.public";


@Module({
  imports: [
    PrismaModule,
    CacheModule.register(),
  ],
  providers: [
    UserService,
    UserBehaviorService,
    AccountUserActivityService,
  ],
  controllers: [CurrentUserController, UserAdminController, UserPublicController],
  exports: [UserService],
})
export class UserModule {}