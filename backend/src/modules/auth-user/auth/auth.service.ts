import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../../common/interfaces/authenticated-request.interface';
import { hashPassword, verifyPassword } from '../../../common/utils/password.util';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AUDIT_ACTION,
  DEFAULT_ROLE,
  INVALID_CREDENTIALS_MESSAGE,
  normalizeVnPhone,
  REGISTERABLE_ROLES,
  USER_STATUS,
} from './auth.constants';
import type { AuthUserDto, LoginResponseDto, LogoutResponseDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

/** Thông tin ngữ cảnh request để ghi audit log. */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

/** Truy vấn user kèm role → permission (dùng cho login và /auth/me). */
const userWithAccessInclude = {
  roles: {
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userWithAccessInclude }>;

@Injectable()
export class AuthService {
  private readonly salt: string;
  private readonly expiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.salt = config.getOrThrow<string>('PASSWORD_SALT');
    this.expiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '7d';
  }

  // ------------------------------------------------------------------
  // POST /auth/register
  // ------------------------------------------------------------------
  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthUserDto> {
    const email = dto.email.toLowerCase();
    const phone = normalizeVnPhone(dto.phone);

    // SECURITY: Chống SQL Injection bằng parameterized query
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === email ? 'Email đã được sử dụng' : 'Số điện thoại đã được sử dụng',
      );
    }

    // Role đã qua whitelist ở DTO (@IsIn REGISTERABLE_ROLES); kiểm tra lại phòng khi DTO bị bỏ qua.
    const roleName = REGISTERABLE_ROLES.includes(dto.role) ? dto.role : DEFAULT_ROLE;
    // SECURITY: Chống SQL Injection bằng parameterized query
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      // Thiếu dữ liệu seed — lỗi cấu hình hệ thống, không phải lỗi người dùng
      throw new InternalServerErrorException(`Hệ thống chưa khởi tạo vai trò ${roleName}`);
    }

    const passwordHash = hashPassword(dto.password, this.salt);

    try {
      // Tạo User + UserRole + GreenPointAccount + AuditLog trong MỘT transaction:
      // bất kỳ bước nào lỗi thì rollback toàn bộ, không để lại tài khoản "nửa vời".
      const user = await this.prisma.$transaction(async (tx) => {
        // SECURITY: Chống SQL Injection bằng parameterized query
        const created = await tx.user.create({
          data: {
            fullName: dto.fullName,
            email,
            phone,
            passwordHash,
            status: USER_STATUS.ACTIVE,
            roles: { create: { roleId: role.id } },
            greenPointAccount: { create: { balance: 0n } },
            // Địa chỉ đăng ký → địa chỉ mặc định. Bảng address tách tỉnh/phường nhưng form đăng ký
            // chỉ có 1 ô địa chỉ → lưu toàn bộ vào address_line; tỉnh/phường bổ sung khi thanh toán.
            addresses: {
              create: {
                recipientName: dto.fullName,
                phone,
                province: '',
                ward: '',
                addressLine: dto.address,
                isDefault: true,
              },
            },
          },
          include: userWithAccessInclude,
        });

        await tx.auditLog.create({
          data: {
            actorUserId: created.id,
            action: AUDIT_ACTION.REGISTER,
            entityType: 'User',
            entityId: created.id,
            // FIXME(schema): bảng `user` chưa có cột date_of_birth → tạm lưu ngày sinh trong audit log.
            // Cần migration bổ sung cột `user.date_of_birth DATE` rồi chuyển sang lưu ở bảng user.
            newValue: {
              email,
              phone,
              fullName: dto.fullName,
              dateOfBirth: dto.dateOfBirth,
              roles: [roleName],
            },
            note: this.formatMeta(meta),
          },
        });
        return created;
      });

      // TODO: Email verification hook
      // (Giai đoạn sau: tạo token xác thực + gửi email kích hoạt cho `user.email` tại đây.)

      return this.toAuthUser(user);
    } catch (e) {
      // Hai request đăng ký cùng email chạy song song → UNIQUE(email) của MySQL chặn lại
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw e;
    }
  }

  // ------------------------------------------------------------------
  // POST /auth/login
  // ------------------------------------------------------------------
  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResponseDto> {
    const identifier = dto.identifier.trim();
    const where: Prisma.UserWhereInput = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { phone: normalizeVnPhone(identifier) };

    // SECURITY: Chống SQL Injection bằng parameterized query
    // (identifier chỉ được truyền như GIÁ TRỊ tham số, không bao giờ nối chuỗi SQL)
    const user = await this.prisma.user.findFirst({ where, include: userWithAccessInclude });

    if (!user) {
      // Vẫn băm một lần để thời gian phản hồi tương đương → khó dò email/SĐT tồn tại
      hashPassword(dto.password, this.salt);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    if (!verifyPassword(dto.password, this.salt, user.passwordHash)) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    // Chỉ báo trạng thái tài khoản SAU KHI mật khẩu đúng (tránh lộ thông tin cho kẻ dò)
    if (user.status !== USER_STATUS.ACTIVE) {
      throw new ForbiddenException(this.statusMessage(user.status));
    }

    // TODO: Email verification check hook
    // (Giai đoạn sau: chặn đăng nhập nếu email chưa được xác thực.)

    const authUser = this.toAuthUser(user);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: authUser.roles,
      permissions: authUser.permissions,
    };
    const accessToken = await this.jwt.signAsync(payload);

    // SECURITY: Chống SQL Injection bằng parameterized query
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: AUDIT_ACTION.LOGIN,
        entityType: 'User',
        entityId: user.id,
        note: this.formatMeta(meta),
      },
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.expiresIn,
      user: authUser,
    };
  }

  // ------------------------------------------------------------------
  // POST /auth/logout — JWT là stateless: client xóa token, server ghi nhật ký
  // ------------------------------------------------------------------
  async logout(userId: string, meta: RequestMeta): Promise<LogoutResponseDto> {
    // SECURITY: Chống SQL Injection bằng parameterized query
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AUDIT_ACTION.LOGOUT,
        entityType: 'User',
        entityId: userId,
        note: this.formatMeta(meta),
      },
    });
    return { loggedOut: true };
  }

  // ------------------------------------------------------------------
  // GET /auth/me
  // ------------------------------------------------------------------
  async getProfile(userId: string): Promise<AuthUserDto> {
    // SECURITY: Chống SQL Injection bằng parameterized query
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithAccessInclude,
    });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    return this.toAuthUser(user);
  }

  // ------------------------------------------------------------------
  private toAuthUser(user: UserWithAccess): AuthUserDto {
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.permissionCode)),
      ),
    ].sort();
    // Chủ động liệt kê field → password_hash không bao giờ lọt ra response
    return {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles,
      permissions,
      createdAt: user.createdAt,
    };
  }

  private statusMessage(status: string): string {
    switch (status) {
      case USER_STATUS.LOCKED:
        return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên';
      case USER_STATUS.PENDING:
        return 'Tài khoản đang chờ kích hoạt';
      default:
        return 'Tài khoản đã ngừng hoạt động';
    }
  }

  private formatMeta(meta: RequestMeta): string | null {
    const parts = [
      meta.ip ? `ip=${meta.ip}` : null,
      meta.userAgent ? `ua=${meta.userAgent.slice(0, 255)}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join('; ') : null;
  }
}
