import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { UserModule } from "../user/user.module";
import { LocalStrategy } from "./strategies/local.strategy";
import { PrismaModule } from "../prisma/prisma.module";
import { VerificationService } from "./verification.service";
import { AccountModule } from "../account/account.module";
import { PlanModule } from "../plan/plan.module";
import { CreditTransactionModule } from "../credit-transaction/credit-transaction.module";
import { FileModule } from "../file/file.module"; // اضافه کردن این خط

@Module({
  imports: [
    UserModule,
    PrismaModule,
    AccountModule,
    PlanModule,
    CreditTransactionModule,
    FileModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>("JWT_EXPIRES_IN") || "7d";

        return {
          secret: configService.get<string>("JWT_SECRET"),
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy, VerificationService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}