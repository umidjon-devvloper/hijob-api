import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { CatalogModule } from './catalog/catalog.module';
import { TryOnModule } from './tryon/tryon.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { SellerModule } from './seller/seller.module';
import { StorageModule } from './storage/storage.module';
import { PaymentModule } from './payment/payment.module';
import { SmsModule } from './sms/sms.module';
import { PushModule } from './push/push.module';
import { AdminModule } from './admin/admin.module';
import { StyleJobsModule } from './style-jobs/style-jobs.module';
import { MannequinTemplatesModule } from './mannequin-templates/mannequin-templates.module';
import { UserFaceRendersModule } from './user-face-renders/user-face-renders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      { name: 'strict', ttl: 60_000, limit: 10 },
    ]),
    PrismaModule,
    StorageModule,
    SmsModule,
    PushModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OnboardingModule,
    CatalogModule,
    TryOnModule,
    CartModule,
    OrdersModule,
    AddressesModule,
    WishlistModule,
    NotificationsModule,
    SellerModule,
    PaymentModule,
    AdminModule,
    StyleJobsModule,
    MannequinTemplatesModule,
    UserFaceRendersModule,
  ],
})
export class AppModule {}
