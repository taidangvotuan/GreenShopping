import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../../src/common/interfaces/authenticated-request.interface';
import { JwtStrategy } from '../../src/modules/auth-user/auth/jwt.strategy';
import type { PrismaService } from '../../src/prisma/prisma.service';

const USER_ID = '7d4f6f0e-2a59-4a8e-9a43-0b6f3f6b1c11';
const JTI = '3f9c5a8e-1d2b-4c6f-8a7e-9b0c1d2e3f40';
const EXP = 1_900_000_000;

function setup() {
  const prisma = {
    user: { findUnique: jest.fn() },
    revokedToken: { findUnique: jest.fn() },
  };
  const config = {
    getOrThrow: () => 'unit-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(config, prisma as unknown as PrismaService);
  return { strategy, prisma };
}

const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: USER_ID,
  jti: JTI,
  email: 'khach@test.greenshopping.vn',
  roles: ['CUSTOMER'],
  permissions: ['order:create'],
  iat: EXP - 1800,
  exp: EXP,
  ...overrides,
});

const activeUser = (...roles: string[]) => ({
  status: 'ACTIVE',
  roles: roles.map((name) => ({ role: { name } })),
});

describe('JwtStrategy.validate (BM-03)', () => {
  it('token hợp lệ → trả về user, roles đọc lại từ CSDL (không tin claim)', async () => {
    const { strategy, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(activeUser('SELLER'));
    prisma.revokedToken.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload({ roles: ['ADMIN'] }))).resolves.toEqual({
      userId: USER_ID,
      email: 'khach@test.greenshopping.vn',
      roles: ['SELLER'],
      permissions: ['order:create'],
      jti: JTI,
      tokenExpiresAt: new Date(EXP * 1000),
    });
    expect(prisma.revokedToken.findUnique).toHaveBeenCalledWith({
      where: { jti: JTI },
      select: { jti: true },
    });
  });

  it('jti đã bị thu hồi (logout) → 401', async () => {
    const { strategy, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(activeUser('CUSTOMER'));
    prisma.revokedToken.findUnique.mockResolvedValue({ jti: JTI });

    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['thiếu jti (token phát hành trước khi có cơ chế thu hồi)', { jti: undefined }],
    ['jti rỗng', { jti: '' }],
    ['thiếu exp', { exp: undefined }],
  ])('%s → 401, không truy vấn CSDL', async (_label, overrides) => {
    const { strategy, prisma } = setup();

    await expect(
      strategy.validate(payload(overrides as unknown as Partial<JwtPayload>)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['tài khoản không còn tồn tại', null],
    ['tài khoản bị khóa', { status: 'LOCKED', roles: [] }],
  ])('%s → 401', async (_label, user) => {
    const { strategy, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.revokedToken.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
