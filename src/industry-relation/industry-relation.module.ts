// industry-relation/industry-relation.module.ts
import { Module } from '@nestjs/common';
import { IndustryRelationService } from './industry-relation.service';

import { IndustryRelationControllerPublic } from './industry-relation.controller.public';
import { PrismaModule } from '../prisma/prisma.module';
import {IndustryRelationAdminController} from "./industry-relation.controller.admin";

@Module({
    imports: [PrismaModule],
    providers: [IndustryRelationService],
    controllers: [IndustryRelationAdminController, IndustryRelationControllerPublic],
    exports: [IndustryRelationService],
})
export class IndustryRelationModule {}