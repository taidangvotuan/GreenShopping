/**
 * E2E — Miền 1 Auth & RBAC.
 * Yêu cầu: MySQL đang chạy (npm run db:up) và đã migrate (prisma migrate dev).
 * Chạy: npm run test:e2e -w backend -- auth
 *
 * Test tự tạo dữ liệu với email/SĐT ngẫu nhiên và tự dọn sau khi chạy,
 * không phụ thuộc dữ liệu seed tài khoản mẫu.
 */
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/common/config/app-setup';
import {
  hashLegacyPassword,
  hashPassword,
  isBcryptHash,
} from '../../src/common/utils/password.util';
import { PrismaService } from '../../src/prisma/prisma.service';

process.env.NODE_ENV = 'test';

const RUN = Date.now().toString().slice(-6);
const STRONG_PASSWORD = 'GreenShop@2026';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** "30m" → 1800 — cú pháp <số><s|m|h|d> mà env.validation.ts cho phép. */
function ttlSeconds(ttl: string): number {
  const unit = { s: 1, m: 60, h: 3600, d: 86_400 }[ttl.slice(-1) as 's' | 'm' | 'h' | 'd'];
  return Number(ttl.slice(0, -1)) * unit;
}

interface AccessTokenClaims {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  roles: string[];
  permissions: string[];
}

/** Giải mã phần payload của JWT (không xác minh chữ ký — chỉ để đọc claim trong test). */
function decodeJwt(token: string): AccessTokenClaims {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

/** SĐT = "09" + 6 số theo lần chạy + 2 số thứ tự → đúng 10 chữ số, không trùng. */
let phoneSeq = 0;
let emailSeq = 0;
const nextPhone = () => `09${RUN}${String(phoneSeq++).padStart(2, '0')}`;
const nextEmail = (tag: string) => `e2e.${tag}.${RUN}.${emailSeq++}@test.greenshopping.vn`;

describe('Auth & RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

  const customer = {
    fullName: '  Nguyễn   Văn E2E  ',
    dateOfBirth: '2000-01-31',
    phone: nextPhone(),
    address: '  24 Nguyễn Hữu Cảnh,  TP. Hồ Chí Minh ',
    email: nextEmail('customer'),
    password: STRONG_PASSWORD,
    confirmPassword: STRONG_PASSWORD,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // Bảo đảm role tồn tại kể cả khi chưa chạy seed
    for (const name of ['CUSTOMER', 'SELLER', 'STAFF', 'ADMIN']) {
      await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    }
  });

  afterAll(async () => {
    if (prisma && createdUserIds.length) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }); // cascade UserRole, GreenPointAccount
    }
    await app?.close();
  });

  /** Tạo trực tiếp user có role/status/hash tùy ý để test RBAC, trạng thái tài khoản và hash cũ. */
  async function createUserDirect(role: string, status = 'ACTIVE', passwordHash?: string) {
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { name: role } });
    const user = await prisma.user.create({
      data: {
        fullName: `E2E ${role}`,
        email: nextEmail(role.toLowerCase()),
        phone: nextPhone(),
        passwordHash: passwordHash ?? (await hashPassword(STRONG_PASSWORD)),
        status,
        roles: { create: { roleId: roleRow.id } },
        greenPointAccount: { create: {} },
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  const login = (identifier: string, password: string) =>
    request(app.getHttpServer()).post('/api/auth/login').send({ identifier, password });

  // ------------------------------------------------------------------
  describe('POST /api/auth/register', () => {
    it('201 — tạo User + UserRole(CUSTOMER) + GreenPointAccount(0) + AuditLog, không lộ password_hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(customer)
        .expect(201);

      expect(res.body.success).toBe(true);
      const user = res.body.data;
      createdUserIds.push(user.userId);

      expect(user).toMatchObject({
        fullName: 'Nguyễn Văn E2E', // đã trim + gộp khoảng trắng giữa các từ
        email: customer.email,
        phone: customer.phone,
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);

      const db = await prisma.user.findUniqueOrThrow({
        where: { id: user.userId },
        include: { roles: { include: { role: true } }, greenPointAccount: true },
      });
      expect(db.roles.map((r) => r.role.name)).toEqual(['CUSTOMER']);
      expect(db.greenPointAccount?.balance).toBe(0n);
      expect(db.passwordHash).not.toBe(customer.password);
      expect(isBcryptHash(db.passwordHash)).toBe(true); // BM-02: bcrypt, không còn SHA-256

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: user.userId, action: 'REGISTER', entityType: 'User' },
      });
      expect(audit).not.toBeNull();
    });

    it('409 — trùng email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...customer, phone: nextPhone() })
        .expect(409);
      expect(res.body.message).toBe('Email đã được sử dụng');
    });

    it('409 — trùng email khác hoa/thường', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...customer, email: customer.email.toUpperCase(), phone: nextPhone() })
        .expect(409);
    });

    it('409 — trùng số điện thoại (kể cả dạng +84)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...customer, email: nextEmail('dup'), phone: `+84${customer.phone.slice(1)}` })
        .expect(409);
      expect(res.body.message).toBe('Số điện thoại đã được sử dụng');
    });

    it('DL-01: 2 đăng ký đồng thời cùng SĐT → đúng một 201 và một 409 "Số điện thoại đã được sử dụng"', async () => {
      const phone = nextPhone();
      const responses = await Promise.all(
        ['race-a', 'race-b'].map((tag) =>
          request(app.getHttpServer())
            .post('/api/auth/register')
            .send({ ...customer, email: nextEmail(tag), phone }),
        ),
      );
      for (const res of responses) {
        if (res.status === 201) createdUserIds.push(res.body.data.userId);
      }

      expect(responses.map((res) => res.status).sort((a, b) => a - b)).toEqual([201, 409]);
      expect(responses.find((res) => res.status === 409)?.body.message).toBe(
        'Số điện thoại đã được sử dụng',
      );
      await expect(prisma.user.count({ where: { phone } })).resolves.toBe(1);
    });

    it.each([
      ['quá ngắn', 'Ab@1'],
      ['thiếu chữ hoa', 'greenshop@2026'],
      ['thiếu chữ thường', 'GREENSHOP@2026'],
      ['thiếu chữ số', 'GreenShop@abc'],
      ['thiếu ký tự đặc biệt', 'GreenShop2026'],
      ['có khoảng trắng', 'Green Shop@2026'],
      ['có khoảng trắng ở đầu', ' GreenShop@2026'],
    ])('400 — mật khẩu %s', async (_label, password) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          ...customer,
          email: nextEmail('weak'),
          phone: nextPhone(),
          password,
          confirmPassword: password,
        })
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.join(' ')).toMatch(/Mật khẩu/);
    });

    it('400 — sai định dạng / rỗng / khoảng trắng / ngày sinh tương lai / mật khẩu xác nhận lệch', async () => {
      for (const patch of [
        { phone: '12345' },
        { phone: '091 234 5678' },
        { email: 'not-an-email' },
        { email: 'a b@example.com' },
        { fullName: '   ' },
        { address: '   ' },
        { dateOfBirth: '2999-01-01' },
        { dateOfBirth: '2001-02-30' },
        { dateOfBirth: '' },
        { confirmPassword: `${STRONG_PASSWORD}x` },
      ]) {
        await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({ ...customer, email: nextEmail('bad'), phone: nextPhone(), ...patch })
          .expect(400);
      }
    });

    // BM-06 — hồi quy: đăng ký công khai không bao giờ tự cấp được quyền vận hành/quản trị
    it.each(['ADMIN', 'STAFF', 'SELLER', 'CUSTOMER', 'admin'])(
      'BM-06: 400 — gửi kèm role=%s bị từ chối (forbidNonWhitelisted), không tạo tài khoản',
      async (role) => {
        const email = nextEmail('role');
        const res = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({ ...customer, email, phone: nextPhone(), role })
          .expect(400);
        expect(res.body.errors.join(' ')).toMatch(/role should not exist/);
        await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
      },
    );

    it('BM-06: 201 — đăng ký công khai luôn chỉ cấp CUSTOMER (kiểm cả CSDL)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...customer, email: nextEmail('public'), phone: nextPhone() })
        .expect(201);
      createdUserIds.push(res.body.data.userId);

      expect(res.body.data.roles).toEqual(['CUSTOMER']);
      const roles = await prisma.userRole.findMany({
        where: { userId: res.body.data.userId },
        include: { role: true },
      });
      expect(roles.map((row) => row.role.name)).toEqual(['CUSTOMER']);
    });
  });

  // ------------------------------------------------------------------
  describe('POST /api/auth/login', () => {
    it('200 — đăng nhập bằng email, trả JWT có roles/permissions', async () => {
      const res = await login(customer.email, customer.password).expect(200);
      const { access_token, user } = res.body.data;
      expect(typeof access_token).toBe('string');
      expect(access_token.split('.')).toHaveLength(3);

      const payload = decodeJwt(access_token);
      expect(payload.sub).toBe(user.userId);
      expect(payload.jti).toMatch(UUID_REGEX); // BM-03: định danh phiên để thu hồi
      expect(payload.roles).toEqual(['CUSTOMER']);
      expect(Array.isArray(payload.permissions)).toBe(true);
      // BM-03: hạn theo JWT_ACCESS_EXPIRES_IN (mặc định 30m), không còn cố định 7 ngày
      const ttl = app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
      expect(payload.exp - payload.iat).toBe(ttlSeconds(ttl));
      expect(res.body.data.expires_in).toBe(ttl);
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: user.userId, action: 'LOGIN' },
      });
      expect(audit).not.toBeNull();
    });

    it('200 — đăng nhập bằng số điện thoại', async () => {
      await login(customer.phone, customer.password).expect(200);
    });

    it('401 — sai mật khẩu, thông báo chung', async () => {
      const res = await login(customer.email, 'WrongPass@123').expect(401);
      expect(res.body.message).toBe('Tên đăng nhập hoặc mật khẩu không đúng');
    });

    it('401 — tài khoản không tồn tại, cùng thông báo chung', async () => {
      const res = await login('khong.ton.tai@test.greenshopping.vn', STRONG_PASSWORD).expect(401);
      expect(res.body.message).toBe('Tên đăng nhập hoặc mật khẩu không đúng');
    });

    // QA-03: định danh chứa khoảng trắng bị LoginDto từ chối ở tầng validation (400) trước khi tới CSDL
    it.each([
      ["' OR '1'='1", 'anything'],
      ["admin@greenshopping.vn' --", 'anything'],
      ["' OR 1=1; DROP TABLE user; --", 'x'],
    ])('400 — payload SQL Injection có khoảng trắng bị DTO chặn: %s', async (identifier, password) => {
      const res = await login(identifier, password);
      expect(res.status).toBe(400);
      expect(res.body.data).toBeUndefined();
      expect(res.body.errors.join(' ')).toMatch(/khoảng trắng/);
      // Bảng user vẫn còn nguyên
      await expect(prisma.user.count()).resolves.toBeGreaterThan(0);
    });

    // Không có khoảng trắng → qua DTO, tới CSDL dưới dạng GIÁ TRỊ tham số → chỉ là sai thông tin (401)
    it.each([
      ["'OR'1'='1", 'anything'],
      ["admin@greenshopping.vn'--", 'anything'],
      [customer.email, "'OR'1'='1"],
    ])('401 — payload SQL Injection không khoảng trắng bị vô hiệu: %s', async (identifier, password) => {
      const res = await login(identifier, password);
      expect(res.status).toBe(401);
      expect(res.body.data).toBeUndefined();
      expect(res.body.message).toBe('Tên đăng nhập hoặc mật khẩu không đúng');
      await expect(prisma.user.count()).resolves.toBeGreaterThan(0);
    });

    it('BM-02: tài khoản còn hash SHA-256 cũ đăng nhập được và được nâng cấp sang bcrypt', async () => {
      const legacyHash = hashLegacyPassword(STRONG_PASSWORD, process.env.PASSWORD_SALT!);
      const legacy = await createUserDirect('CUSTOMER', 'ACTIVE', legacyHash);

      await login(legacy.email, STRONG_PASSWORD).expect(200);

      const upgraded = await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } });
      expect(upgraded.passwordHash).not.toBe(legacyHash);
      expect(isBcryptHash(upgraded.passwordHash)).toBe(true);
      // Lần sau đăng nhập bằng hash bcrypt mới
      await login(legacy.email, STRONG_PASSWORD).expect(200);
      await login(legacy.email, 'WrongPass@123').expect(401);
    });

    it('400 — mật khẩu chứa khoảng trắng / thiếu trường', async () => {
      await login(customer.email, "' OR '1'='1").expect(400);
      await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);
    });

    it('403 — tài khoản LOCKED không đăng nhập được', async () => {
      const locked = await createUserDirect('CUSTOMER', 'LOCKED');
      const res = await login(locked.email, STRONG_PASSWORD).expect(403);
      expect(res.body.message).toMatch(/khóa/);
    });

    it('401 — tài khoản LOCKED nhưng sai mật khẩu vẫn trả thông báo chung', async () => {
      const locked = await createUserDirect('CUSTOMER', 'LOCKED');
      await login(locked.email, 'WrongPass@123').expect(401);
    });
  });

  // ------------------------------------------------------------------
  describe('JWT & RBAC', () => {
    let customerToken: string;

    beforeAll(async () => {
      const res = await login(customer.email, customer.password);
      customerToken = res.body.data.access_token;
    });

    it('GET /api/auth/me — 200 với token hợp lệ', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(res.body.data.email).toBe(customer.email);
    });

    it('401 — không có token / token giả mạo', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
      const forged = `${customerToken.slice(0, -4)}AAAA`;
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('403 — CUSTOMER gọi API chỉ dành cho ADMIN/STAFF', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      expect(res.body.success).toBe(false);
    });

    it('403 — SELLER gọi API quản trị', async () => {
      const seller = await createUserDirect('SELLER');
      const token = (await login(seller.email, STRONG_PASSWORD)).body.data.access_token;
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('200 — ADMIN gọi API quản trị, không lộ password_hash', async () => {
      const admin = await createUserDirect('ADMIN');
      const token = (await login(admin.email, STRONG_PASSWORD)).body.data.access_token;
      const res = await request(app.getHttpServer())
        .get('/api/users?limit=5')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('401 — token của tài khoản vừa bị khóa mất hiệu lực ngay', async () => {
      const user = await createUserDirect('CUSTOMER');
      const token = (await login(user.email, STRONG_PASSWORD)).body.data.access_token;
      await prisma.user.update({ where: { id: user.id }, data: { status: 'LOCKED' } });
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    // BM-06 — luồng cấp quyền riêng, chỉ ADMIN, có audit log
    describe('PATCH /api/users/:id/roles', () => {
      const assignRole = (token: string | undefined, userId: string, role: unknown) => {
        const call = request(app.getHttpServer()).patch(`/api/users/${userId}/roles`);
        return (token ? call.set('Authorization', `Bearer ${token}`) : call).send({ role });
      };
      const tokenOf = async (email: string) =>
        (await login(email, STRONG_PASSWORD)).body.data.access_token as string;

      it('401 — không có token', async () => {
        await assignRole(undefined, randomUUID(), 'ADMIN').expect(401);
      });

      it('403 — CUSTOMER tự cấp ADMIN cho chính mình bị chặn, vai trò trong CSDL không đổi', async () => {
        const me = await prisma.user.findUniqueOrThrow({ where: { email: customer.email } });
        await assignRole(customerToken, me.id, 'ADMIN').expect(403);
        const roles = await prisma.userRole.findMany({ where: { userId: me.id }, include: { role: true } });
        expect(roles.map((row) => row.role.name)).toEqual(['CUSTOMER']);
      });

      it('200 — ADMIN cấp/thu hồi quyền: có hiệu lực ngay với token đang dùng, ghi AuditLog ROLE_CHANGE', async () => {
        const admin = await createUserDirect('ADMIN');
        const target = await createUserDirect('CUSTOMER');
        const adminToken = await tokenOf(admin.email);
        const targetToken = await tokenOf(target.email); // token phát hành khi còn là CUSTOMER

        const promoted = await assignRole(adminToken, target.id, 'staff').expect(200);
        expect(promoted.body.data).toMatchObject({ roles: ['STAFF'], previousRoles: ['CUSTOMER'] });
        await request(app.getHttpServer())
          .get('/api/users')
          .set('Authorization', `Bearer ${targetToken}`)
          .expect(200);

        await assignRole(adminToken, target.id, 'CUSTOMER').expect(200);
        await request(app.getHttpServer())
          .get('/api/users')
          .set('Authorization', `Bearer ${targetToken}`)
          .expect(403);

        // created_at là TIMESTAMP(0): hai lần đổi trong cùng một giây → không dựa vào thứ tự bản ghi
        const audits = await prisma.auditLog.findMany({
          where: { entityId: target.id, action: 'ROLE_CHANGE' },
        });
        expect(audits).toHaveLength(2);
        expect(audits).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              actorUserId: admin.id,
              entityType: 'User',
              oldValue: { roles: ['CUSTOMER'] },
              newValue: { roles: ['STAFF'] },
            }),
            expect.objectContaining({
              actorUserId: admin.id,
              oldValue: { roles: ['STAFF'] },
              newValue: { roles: ['CUSTOMER'] },
            }),
          ]),
        );
      });

      it('400 — ADMIN tự đổi vai trò của mình / vai trò không hợp lệ; 404 — tài khoản không tồn tại', async () => {
        const admin = await createUserDirect('ADMIN');
        const adminToken = await tokenOf(admin.email);
        await assignRole(adminToken, admin.id, 'CUSTOMER').expect(400);
        await assignRole(adminToken, admin.id, 'SUPERADMIN').expect(400);
        await assignRole(adminToken, randomUUID(), 'SELLER').expect(404);
      });
    });

    it('POST /api/auth/logout — 200, ghi AuditLog LOGOUT và THU HỒI token vừa dùng (BM-03)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(res.body.data).toEqual({ loggedOut: true });

      const me = await prisma.user.findUniqueOrThrow({ where: { email: customer.email } });
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: me.id, action: 'LOGOUT' },
      });
      expect(audit).not.toBeNull();

      // Token đã logout bị từ chối dù chưa hết hạn; jti nằm trong revoked_token
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(401);
      const { jti } = decodeJwt(customerToken);
      await expect(prisma.revokedToken.findUnique({ where: { jti } })).resolves.not.toBeNull();

      // Chỉ thu hồi phiên hiện tại: đăng nhập lại có token mới dùng được
      const fresh = (await login(customer.email, customer.password)).body.data.access_token;
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fresh}`)
        .expect(200);
    });

    it('401 — logout khi chưa đăng nhập', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });
  });
});
