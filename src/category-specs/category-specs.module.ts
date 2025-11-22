// src/category-specs/category-specs.module.ts
import { Module } from '@nestjs/common';
import { CategorySpecsService } from './category-specs.service';
import { CategorySpecsAdminController } from './category-specs-admin.controller';
import { CategorySpecsPublicController } from './category-specs-public.controller';
import { CategorySpecsUserController } from './category-specs-user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

@Module({
    controllers: [CategorySpecsAdminController, CategorySpecsPublicController, CategorySpecsUserController],
    providers: [CategorySpecsService, PrismaService, I18nService],
    exports: [CategorySpecsService],
})
export class CategorySpecsModule {}