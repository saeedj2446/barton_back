// src/specs/specs.module.ts
import { Module } from '@nestjs/common';
import { SpecsService } from './specs.service';
import { SpecsAdminController } from './specs-admin.controller';
import { SpecsPublicController } from './specs-public.controller';
import { SpecsUserController } from './specs-user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

@Module({
    controllers: [SpecsAdminController, SpecsPublicController, SpecsUserController],
    providers: [SpecsService, PrismaService, I18nService],
    exports: [SpecsService],
})
export class SpecsModule {}