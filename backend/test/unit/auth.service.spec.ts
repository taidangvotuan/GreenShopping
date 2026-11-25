import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from '../../src/common/interfaces/authenticated-request.interface';
import {
  hashLegacyPassword,
  hashPassword,
  isBcryptHash,
} from '../../src/common/utils/password.util';
import { AuthService } from '../../src/modules/auth-user/auth/auth.service';
import type { LoginDto } from '../../src/modules/auth-user/auth/dto/login.dto';
import type { RegisterDto } from '../../src/modules/auth-user/auth/dto/register.dto';
import type { PrismaService } from '../../src/prisma/prisma.service';

jest.setTimeout(30_000);

const PASSWORD = 'GreenShop@2026';
const LEGACY_SALT = 'legacy_salt_for_unit_test_0001';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const registerDto = {
  fullName: 'Khách Hàng Test',
  dateOfBirth: '2000-01-31',
  phone: '0912345678',
  address: '01 Lê Lợi, TP. Hồ Chí Minh',
  email: 'khach@test.greenshopping.vn',
  password: PASSWORD,
  confirmPassword: PASSWORD,
} satisfies RegisterDto;

function userRow(passwordHash: string, overrides: Record<string, unknown> = {}) {
  return {
    id: '7d4f6f0e-2a59-4a8e-9a43-0b6f3f6b1c11',
    fullName: registerDto.fullName,
    email: registerDto.email,
    phone: registerDto.phone,
    passwordHash,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    roles: [
      {
        role: { name: 'CUSTOMER', permissions: [{ permission: { permissionCode: 'order:create' } }] },
      },
    ],
    ...overrides,
  };
}

function setup() {
  const tx = {
    user: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    role: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    revokedToken: { upsert: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (client: typeof tx) => unknown)(tx),
    ),
  };
  const config = {
    getOrThrow: (key: string) =>
      ({ PASSWORD_SALT: LEGACY_SALT, JWT_ACCESS_EXPIRES_IN: '30m' })[key] ??
      (() => {
        throw new Error(`missing ${key}`);
      })(),
  } as unknown as ConfigService;
  const jwt = new JwtService({
    secret: 'unit-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
    signOptions: { algorithm: 'HS256', expiresIn: '30m' },
  });
  const service = new AuthService(prisma as unknown as PrismaService, jwt, config);
  return { service, prisma, tx, jwt };
}

/** Lỗi unique như Prisma 7 + adapter MariaDB ném ra (không có meta.target). */
function adapterUniqueError(index: string) {
  return Object.assign(new Error(`Unique constraint failed on the constraint: \`${index}\``), {
    code: 'P2002',
    meta: {
      driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint: { index } } },
    },
  });
}

describe('AuthService.register', () => {
  it('BM-06: luôn gán CUSTOMER kể cả khi payload lọt kèm role=ADMIN; mật khẩu băm bcrypt', async () => {
    const { service, prisma, tx } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'role-customer', name: 'CUSTOMER' });
    tx.user.create.mockImplementation(({ data }: { data: { passwordHash: string } }) =>
      Promise.resolve(userRow(data.passwordHash)),
    );

    const tampered = { ...registerDto, role: 'ADMIN' } as unknown as RegisterDto;
    const user = await service.register(tampered, {});

    expect(prisma.role.findUnique).toHaveBeenCalledWith({ where: { name: 'CUSTOMER' } });
    const { data } = tx.user.create.mock.calls[0][0];
    expect(data.roles).toEqual({ create: { roleId: 'role-customer' } });
    expect(isBcryptHash(data.passwordHash)).toBe(true);
    expect(tx.auditLog.create.mock.calls[0][0].data.newValue.roles).toEqual(['CUSTOMER']);
    expect(user.roles).toEqual(['CUSTOMER']);
  });

  it('báo lỗi cấu hình (500) khi CSDL chưa có role CUSTOMER — không rơi về role khác', async () => {
    const { service, prisma, tx } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.register(registerDto, {})).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it.each([
    ['index của adapter: user_phone_key', adapterUniqueError('user_phone_key'), 'Số điện thoại đã được sử dụng'],
    ['index của adapter: user_email_key', adapterUniqueError('user_email_key'), 'Email đã được sử dụng'],
    ['meta.target kiểu cũ: ["phone"]', { code: 'P2002', meta: { target: ['phone'] } }, 'Số điện thoại đã được sử dụng'],
    ['meta.target kiểu cũ: "user_email_key"', { code: 'P2002', meta: { target: 'user_email_key' } }, 'Email đã được sử dụng'],
    ['không có thông tin trường', { code: 'P2002', meta: {} }, 'Email hoặc số điện thoại đã được sử dụng'],
  ])('DL-01: P2002 (%s) → 409 đúng trường', async (_label, error, message) => {
    const { service, prisma, tx } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'role-customer', name: 'CUSTOMER' });
    tx.user.create.mockRejectedValue(error);

    const result = service.register(registerDto, {});
    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toThrow(message);
  });

  it('lỗi khác P2002 được ném tiếp nguyên trạng', async () => {
    const { service, prisma, tx } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 'role-customer', name: 'CUSTOMER' });
    const failure = Object.assign(new Error('deadlock'), { code: 'P2034' });
    tx.user.create.mockRejectedValue(failure);

    await expect(service.register(registerDto, {})).rejects.toBe(failure);
  });
});

describe('AuthService.login', () => {
  const loginDto = (identifier: string, password = PASSWORD): LoginDto => ({ identifier, password });

  it('DL-01: tra cứu bằng findUnique; SĐT dạng +84 được chuẩn hóa về 0xxxxxxxxx', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow(await hashPassword(PASSWORD)));

    await service.login(loginDto('+84912345678'), {});

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: '0912345678' } }),
    );
  });

  it('BM-02: hash SHA-256 cũ đúng mật khẩu → đăng nhập được và tự nâng cấp sang bcrypt (có điều kiện)', async () => {
    const { service, prisma } = setup();
    const legacy = hashLegacyPassword(PASSWORD, LEGACY_SALT);
    prisma.user.findUnique.mockResolvedValue(userRow(legacy));

    const result = await service.login(loginDto(registerDto.email), {});

    expect(result.access_token).toEqual(expect.any(String));
    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.user.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: userRow(legacy).id, passwordHash: legacy });
    expect(isBcryptHash(data.passwordHash)).toBe(true);
  });

  it('BM-02: hash bcrypt hiện hành → không ghi lại hash', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow(await hashPassword(PASSWORD)));

    await service.login(loginDto(registerDto.email), {});

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('BM-02: nâng cấp hash thất bại không chặn đăng nhập (mật khẩu đã đúng), có ghi cảnh báo', async () => {
    const { service, prisma } = setup();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.user.findUnique.mockResolvedValue(userRow(hashLegacyPassword(PASSWORD, LEGACY_SALT)));
    prisma.user.updateMany.mockRejectedValue(new Error('db down'));

    await expect(service.login(loginDto(registerDto.email), {})).resolves.toHaveProperty(
      'access_token',
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Không nâng cấp được hash'));
    warn.mockRestore();
  });

  it('sai mật khẩu (kể cả hash cũ) → 401 thông báo chung, không nâng cấp hash', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow(hashLegacyPassword(PASSWORD, LEGACY_SALT)));

    await expect(service.login(loginDto(registerDto.email, 'WrongPass@123'), {})).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('không tìm thấy tài khoản → 401 cùng thông báo chung', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login(loginDto('khong.ton.tai@test.greenshopping.vn'), {}),
    ).rejects.toThrow('Tên đăng nhập hoặc mật khẩu không đúng');
  });

  it('tài khoản LOCKED, đúng mật khẩu → 403', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(
      userRow(await hashPassword(PASSWORD), { status: 'LOCKED' }),
    );

    await expect(service.login(loginDto(registerDto.email), {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('BM-03: access token có jti (UUID) và hạn theo JWT_ACCESS_EXPIRES_IN', async () => {
    const { service, prisma, jwt } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow(await hashPassword(PASSWORD)));

    const result = await service.login(loginDto(registerDto.email), {});
    const payload = jwt.decode<{ jti: string; sub: string; iat: number; exp: number }>(
      result.access_token,
    );

    expect(payload.jti).toMatch(UUID_REGEX);
    expect(payload.sub).toBe(userRow('').id);
    expect(payload.exp - payload.iat).toBe(30 * 60);
    expect(result.expires_in).toBe('30m');
  });
});

describe('AuthService.logout (BM-03)', () => {
  it('ghi jti vào revoked_token tới khi token hết hạn, ghi audit LOGOUT và dọn bản ghi đã hết hạn', async () => {
    const { service, prisma } = setup();
    const user: AuthenticatedUser = {
      userId: userRow('').id,
      email: registerDto.email,
      roles: ['CUSTOMER'],
      permissions: [],
      jti: '3f9c5a8e-1d2b-4c6f-8a7e-9b0c1d2e3f40',
      tokenExpiresAt: new Date('2026-11-25T10:30:00.000Z'),
    };

    await expect(service.logout(user, { ip: '127.0.0.1' })).resolves.toEqual({ loggedOut: true });

    expect(prisma.revokedToken.upsert).toHaveBeenCalledWith({
      where: { jti: user.jti },
      create: { jti: user.jti, userId: user.userId, expiresAt: user.tokenExpiresAt },
      update: {},
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'LOGOUT', entityId: user.userId }),
    });
    expect(prisma.revokedToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});
