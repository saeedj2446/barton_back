// src/locations/locations.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LocationsService } from './locations.service';
import { LocationsUserController } from './locations-user.controller';
import { LocationsAdminController } from './locations-admin.controller';
import { LocationsPublicController } from './locations-public.controller';

@Module({
    imports: [
        PrismaModule,
    ],
    controllers: [
        LocationsUserController,
        LocationsAdminController,
        LocationsPublicController
    ],
    providers: [LocationsService],
    exports: [LocationsService],
})
export class LocationsModule {}