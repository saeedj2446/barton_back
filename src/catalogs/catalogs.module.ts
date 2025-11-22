// src/catalogs/catalogs.module.ts
import { Module } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { CatalogsAdminController } from './catalogs-admin.controller';
import { CatalogsPublicController } from './catalogs-public.controller';
import { CatalogsUserController } from './catalogs-user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

@Module({
    controllers: [CatalogsAdminController, CatalogsPublicController, CatalogsUserController],
    providers: [CatalogsService, PrismaService, I18nService],
    exports: [CatalogsService],
})
export class CatalogsModule {}