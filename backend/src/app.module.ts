import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './common/config/env.validation';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { AuthUserModule } from './modules/auth-user/auth-user.module';
import { CartOrderModule } from './modules/cart-order/cart-order.module';
import { PromotionModule } from './modules/promotion/promotion.module';
import { ShipmentCarbonModule } from './modules/shipment-carbon/shipment-carbon.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // đọc backend/.env, kiểm tra hợp lệ, dùng được ở mọi module
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Giới hạn tần suất chung; route nhạy cảm (login/register) siết chặt hơn bằng @Throttle
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
      // Bỏ qua khi chạy E2E test để không bị 429 giả
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuthUserModule,
    CartOrderModule,
    PromotionModule,
    ShipmentCarbonModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Thứ tự guard: Throttler → JWT (trừ @Public) → Roles (@Roles)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
