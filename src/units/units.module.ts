// src/units/units.module.ts
import { Module } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitsAdminController } from './units-admin.controller';
import { UnitsPublicController } from './units-public.controller';
import { UnitsUserController } from './units-user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

@Module({
    controllers: [UnitsAdminController, UnitsPublicController, UnitsUserController],
    providers: [UnitsService, PrismaService, I18nService],
    exports: [UnitsService],
})
export class UnitsModule {}