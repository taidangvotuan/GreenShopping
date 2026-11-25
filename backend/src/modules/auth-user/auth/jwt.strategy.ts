import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type {
  AuthenticatedUser,
  JwtPayload,
} from '../../../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { USER_STATUS } from './auth.constants';

const INVALID_SESSION_MESSAGE = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      algorithms: ['HS256'],
    });
  }

  /**
   * Chữ ký và hạn token đã được passport-jwt kiểm tra. Kiểm tra thêm (BM-03):
   *  - token phải có `jti` và `exp` (token cũ phát hành trước khi có cơ chế thu hồi → bị từ chối);
   *  - `jti` chưa bị thu hồi (logout ghi vào bảng revoked_token);
   *  - user còn tồn tại & ACTIVE → tài khoản bị khóa thì token cũ mất hiệu lực ngay;
   *  - roles đọc lại từ CSDL, KHÔNG tin claim → đổi/thu hồi quyền có hiệu lực ngay ở request kế tiếp.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (typeof payload.jti !== 'string' || !payload.jti || typeof payload.exp !== 'number') {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    // SECURITY: Chống SQL Injection bằng parameterized query
    const [user, revoked] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true, roles: { select: { role: { select: { name: true } } } } },
      }),
      this.prisma.revokedToken.findUnique({
        where: { jti: payload.jti },
        select: { jti: true },
      }),
    ]);
    if (!user || user.status !== USER_STATUS.ACTIVE || revoked) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }
    return {
      userId: payload.sub,
      email: payload.email,
      roles: user.roles.map((userRole) => userRole.role.name),
      // permissions trong claim chỉ mang tính thông tin, không được dùng để phân quyền phía server
      permissions: payload.permissions ?? [],
      jti: payload.jti,
      tokenExpiresAt: new Date(payload.exp * 1000),
    };
  }
}
