// src/account/account.module.ts
import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { PrismaModule } from '../prisma/prisma.module';
import {AccountAdminController} from "./account.controller.admin";
import {FileModule} from "../file/file.module";

@Module({
    imports: [PrismaModule,FileModule, ],
    controllers: [AccountController, AccountAdminController],
    providers: [AccountService],
    exports: [AccountService],
})
export class AccountModule {}