// industry/industry.module.ts
import { Module } from '@nestjs/common';
import { IndustryService } from './industry.service';
import { IndustryControllerPublic } from './industry.controller.public';
import { PrismaModule } from '../prisma/prisma.module';
import {IndustryAdminController} from "./industry.controller.admin";

@Module({
    imports: [PrismaModule],
    providers: [IndustryService],
    controllers: [IndustryAdminController, IndustryControllerPublic],
    exports: [IndustryService],
})
export class IndustryModule {}