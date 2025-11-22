// src/brands/brands.module.ts
import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsAdminController } from './brands-admin.controller';
import { BrandsPublicController } from './brands-public.controller';
import { BrandsUserController } from './brands-user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

@Module({
    controllers: [BrandsAdminController, BrandsPublicController, BrandsUserController],
    providers: [BrandsService, PrismaService, I18nService],
    exports: [BrandsService],
})
export class BrandsModule {}