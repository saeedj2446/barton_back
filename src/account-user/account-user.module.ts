import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {AccountUserController} from "./account-user.controller";
import {AccountUserService} from "./account-user.service";

@Module({
    imports: [PrismaModule],
    controllers: [AccountUserController],
    providers: [AccountUserService],
    exports: [AccountUserService],
})
export class AccountUserModule {}