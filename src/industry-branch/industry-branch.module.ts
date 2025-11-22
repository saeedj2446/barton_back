// industry-branch/industry-branch.module.ts
import { Module } from '@nestjs/common';
import { IndustryBranchService } from './industry-branch.service';
import { IndustryBranchControllerPublic } from './industry-branch.controller.public';
import { PrismaModule } from '../prisma/prisma.module';
import {IndustryBranchAdminController} from "./industry-branch.controller.admin";

@Module({
    imports: [PrismaModule],
    providers: [IndustryBranchService],
    controllers: [IndustryBranchAdminController, IndustryBranchControllerPublic],
    exports: [IndustryBranchService],
})
export class IndustryBranchModule {}