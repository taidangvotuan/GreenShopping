import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthenticatedUser,
  JwtPayload,
} from '../../../common/interfaces/authenticated-request.interface';
import {
  hashPassword,
  simulatePasswordCheck,
  verifyPassword,
} from '../../../common/utils/password.util';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AUDIT_ACTION,
  INVALID_CREDENTIALS_MESSAGE,
  normalizeVnPhone,
  PUBLIC_REGISTRATION_ROLE,
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

const EMAIL_TAKEN_MESSAGE = 'Email đã được sử dụng';
const PHONE_TAKEN_MESSAGE = 'Số điện thoại đã được sử dụng';

/** Phần `meta` của lỗi Prisma P2002 (unique constraint) mà ta cần đọc. */
interface UniqueViolationMeta {
  target?: unknown;
  driverAdapterError?: { cause?: { constraint?: { index?: unknown; fields?: unknown } } };
}

/**
 * Trả về chuỗi mô tả cột/index bị trùng (chữ thường) nếu lỗi là P2002, ngược lại null.
 * Prisma 7 + driver adapter MariaDB KHÔNG điền `meta.target`; tên index (vd. `user_phone_key`) nằm ở
 * `meta.driverAdapterError.cause.constraint` → đọc cả hai nguồn để đúng ở mọi phiên bản.
 */
function uniqueViolationTarget(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, meta } = error as { code?: unknown; meta?: UniqueViolationMeta };
  if (code !== 'P2002') return null;
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const parts: unknown[] = [
    ...(Array.isArray(meta?.target) ? meta.target : [meta?.target]),
    constraint?.index,
    ...(Array.isArray(constraint?.fields) ? constraint.fields : []),
  ];
  return parts
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Muối của định dạng SHA-256 cũ — chỉ dùng để xác minh rồi nâng cấp hash cũ sang bcrypt. */
  private readonly legacySalt: string;
  private readonly expiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.legacySalt = config.getOrThrow<string>('PASSWORD_SALT');
    this.expiresIn = config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
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
        existing.email === email ? EMAIL_TAKEN_MESSAGE : PHONE_TAKEN_MESSAGE,
      );
    }

    // SECURITY (BM-06): vai trò cố định phía server — payload không có (và không được có) trường role.
    const roleName = PUBLIC_REGISTRATION_ROLE;
    // SECURITY: Chống SQL Injection bằng parameterized query
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      // Thiếu dữ liệu seed — lỗi cấu hình hệ thống, không phải lỗi người dùng
      throw new InternalServerErrorException(`Hệ thống chưa khởi tạo vai trò ${roleName}`);
    }

    // BM-02: bcrypt (salt riêng từng hash, cost BCRYPT_COST)
    const passwordHash = await hashPassword(dto.password);

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
      // DL-01: hai request đăng ký song song cùng email/SĐT cùng qua bước kiểm tra phía trên
      // → UNIQUE(email) / UNIQUE(phone) của MySQL chặn lại; báo 409 đúng trường bị trùng.
      const target = uniqueViolationTarget(e);
      if (target !== null) {
        throw new ConflictException(
          target.includes('phone')
            ? PHONE_TAKEN_MESSAGE
            : target.includes('email')
              ? EMAIL_TAKEN_MESSAGE
              : 'Email hoặc số điện thoại đã được sử dụng',
        );
      }
      throw e;
    }
  }

  // ------------------------------------------------------------------
  // POST /auth/login
  // ------------------------------------------------------------------
  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResponseDto> {
    const identifier = dto.identifier.trim();
    // DL-01: email và SĐT đều UNIQUE → mỗi định danh trỏ tới đúng một tài khoản
    const where: Prisma.UserWhereUniqueInput = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { phone: normalizeVnPhone(identifier) };

    // SECURITY: Chống SQL Injection bằng parameterized query
    // (identifier chỉ được truyền như GIÁ TRỊ tham số, không bao giờ nối chuỗi SQL)
    const user = await this.prisma.user.findUnique({ where, include: userWithAccessInclude });

    if (!user) {
      // Vẫn chạy một lần so khớp bcrypt để thời gian phản hồi tương đương → khó dò email/SĐT tồn tại
      await simulatePasswordCheck(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    const passwordCheck = await verifyPassword(dto.password, user.passwordHash, this.legacySalt);
    if (!passwordCheck.valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    // BM-02: hash SHA-256 cũ (hoặc bcrypt cost thấp) → nâng cấp sang bcrypt ngay khi mật khẩu đúng
    if (passwordCheck.needsRehash) {
      await this.upgradePasswordHash(user.id, user.passwordHash, dto.password);
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
      // BM-03: định danh phiên — logout thu hồi đúng token này
      jti: randomUUID(),
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
  // POST /auth/logout — thu hồi access token hiện tại (jti) + ghi nhật ký
  // ------------------------------------------------------------------
  async logout(user: AuthenticatedUser, meta: RequestMeta): Promise<LogoutResponseDto> {
    // SECURITY (BM-03): JwtStrategy từ chối jti đã thu hồi cho tới khi token tự hết hạn.
    // SECURITY: Chống SQL Injection bằng parameterized query
    await this.prisma.$transaction([
      this.prisma.revokedToken.upsert({
        where: { jti: user.jti },
        create: { jti: user.jti, userId: user.userId, expiresAt: user.tokenExpiresAt },
        update: {},
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.userId,
          action: AUDIT_ACTION.LOGOUT,
          entityType: 'User',
          entityId: user.userId,
          note: this.formatMeta(meta),
        },
      }),
    ]);
    await this.pruneExpiredRevocations();
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
  /**
   * Ghi hash bcrypt mới. Điều kiện theo hash cũ → không ghi đè nếu mật khẩu vừa đổi ở request khác.
   * Lỗi ở bước này không chặn đăng nhập (mật khẩu đã đúng); lần đăng nhập sau sẽ thử nâng cấp lại.
   */
  private async upgradePasswordHash(
    userId: string,
    currentHash: string,
    password: string,
  ): Promise<void> {
    try {
      // SECURITY: Chống SQL Injection bằng parameterized query
      await this.prisma.user.updateMany({
        where: { id: userId, passwordHash: currentHash },
        data: { passwordHash: await hashPassword(password) },
      });
    } catch (error) {
      this.logger.warn(`Không nâng cấp được hash mật khẩu của user ${userId}: ${String(error)}`);
    }
  }

  /** Bản ghi thu hồi chỉ cần giữ tới khi token tự hết hạn — dọn dần để bảng không phình. */
  private async pruneExpiredRevocations(): Promise<void> {
    try {
      await this.prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch (error) {
      this.logger.warn(`Không dọn được revoked_token đã hết hạn: ${String(error)}`);
    }
  }

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
