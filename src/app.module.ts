// src/app.module.ts
import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { ConfigModule } from "@nestjs/config"
import { ThrottlerModule } from "@nestjs/throttler"
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from "./prisma/prisma.module"
import { AuthModule } from "./auth/auth.module"
import { UserModule } from "./user/user.module"
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard"
import { RolesGuard } from "./common/guards/roles.guard"
import { AccountModule } from "./account/account.module"
import { PlanModule } from "./plan/plan.module"
import { CreditTransactionModule } from "./credit-transaction/credit-transaction.module"
import { CreditActivityModule } from "./credit-activity/credit-activity.module"
import { FileModule } from "./file/file.module";
import {ProductModule} from "./product/product.module";
import {ScheduleModule} from "@nestjs/schedule";
import {CategoriesModule} from "./category/categories.module";
import {ConversationsModule} from "./conversations/conversations.module";
import {MessagesModule} from "./messages/messages.module";
import {ChatModule} from "./chat/chat.module";
// ❌ این خط رو حذف یا کامنت کن
// import {AppCacheModule} from "./cache/cache.module";
import {BuyAdModule} from "./buy-ad/buy-ad.module";
import {OffersModule} from "./offers/offers.module";
import {IndustryBranchModule, IndustryModule, IndustryRelationModule} from "./industry";
import {OrderModule} from "./order/order.module";
import {PaymentModule} from "./payment/payment.module";
import {UserBehaviorModule} from "./ account-user-behavior/user-behavior.module";
import {AccountUserActivityModule} from "./account-user-activity/account-user-activity.module";
import {ProductPriceModule} from "./product-price/product-price.module";
import {TransactionModule} from "./transaction";
import {BrandsModule} from "./brands/brands.module";
import {UnitsModule} from "./units/units.module";
import {SpecsModule} from "./specs/specs.module";
import {CategorySpecsModule} from "./category-specs/category-specs.module";
import {CommonModule} from "./common/common.module";
import {LocationsModule} from "./location/locations.module";
import {MarketAnalyticsModule} from "./market-analytics/market-analytics.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 5 * 60 * 1000, // 5 دقیقه
      max: 100,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'medium',
        ttl: 300000,
        limit: 200,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,
      }
    ]),
    PrismaModule,
    AuthModule,
    AccountModule,
    ProductModule,
    FileModule,
    UserModule,
    PlanModule,
    CreditTransactionModule,
    CreditActivityModule,
    CategoriesModule,
    // ❌ فعلا از ردیس استفاده نکن
    // AppCacheModule,
    ConversationsModule,
    MessagesModule,
    ChatModule,
    BuyAdModule,
    OffersModule,
    IndustryBranchModule,
    IndustryModule,
    IndustryRelationModule,
    OrderModule,
    PaymentModule,
    TransactionModule,
    UserBehaviorModule,
    AccountUserActivityModule,
    ProductPriceModule,
    BrandsModule,
    UnitsModule,
    SpecsModule,
    CategorySpecsModule,
    CommonModule,
    LocationsModule,
    MarketAnalyticsModule,

  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}