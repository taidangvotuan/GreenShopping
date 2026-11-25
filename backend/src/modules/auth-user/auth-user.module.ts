import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

/** Cú pháp thời hạn của thư viện ms, ví dụ "30m", "1h". */
type TokenTtl = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          // BM-03: hạn ngắn, mặc định 30m (env.validation.ts kiểm tra cú pháp <số><s|m|h|d>)
          expiresIn: config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN') as TokenTtl,
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtStrategy, UsersService],
  exports: [AuthService],
})
export class AuthUserModule {}
