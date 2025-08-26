import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ThrottlerModule } from "@nestjs/throttler"
import { PrismaModule } from "./prisma/prisma.module"
import { AuthModule } from "./auth/auth.module"
import { UserModule } from "./user/user.module"
import { ProfileModule } from "./profile/profile.module"
import { AdModule } from "./ad/ad.module"
import { CommentModule } from "./comment/comment.module"
import { FileModule } from "./file/file.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UserModule,
    ProfileModule,
    AdModule,
    CommentModule,
    FileModule,
  ],
})
export class AppModule {}
