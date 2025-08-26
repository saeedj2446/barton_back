import { Module } from "@nestjs/common"
import { CommentService } from "./comment.service"
import { CommentController } from "./comment.controller"
import { AdModule } from "../ad/ad.module"
import {PrismaModule} from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule,AdModule],
  providers: [CommentService],
  controllers: [CommentController],
  exports: [CommentService],
})
export class CommentModule {}
