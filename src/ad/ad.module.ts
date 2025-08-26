import { Module } from "@nestjs/common"
import { AdService } from "./ad.service"
import { AdController } from "./ad.controller"
import { ProfileModule } from "../profile/profile.module"
import {PrismaModule} from "../prisma/prisma.module";

@Module({

  imports: [PrismaModule,ProfileModule],
  providers: [AdService],
  controllers: [AdController],
  exports: [AdService],
})
export class AdModule {}
