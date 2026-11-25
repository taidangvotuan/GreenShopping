import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/common/config/app-setup';
import { hashPassword } from '../../src/common/utils/password.util';
import { PrismaService } from '../../src/prisma/prisma.service';

process.env.NODE_ENV = 'test';

describe('Giỏ hàng, thanh toán và vận chuyển (e2e)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  const run = randomUUID().slice(0, 12);
  const userIds: string[] = [];
  const shopIds: string[] = [];
  const address = {
    recipientName: 'Người nhận E2E',
    phone: '0901234567',
    province: 'TP Hồ Chí Minh',
    ward: 'Phường Bến Thành',
    addressLine: '01 Lê Lợi',
  };
  const password = 'GreenShop@2026';
  const voucherCode = `E2E-${run.toUpperCase()}`;
  const voucher = {
    code: voucherCode,
    name: 'Ưu đãi kiểm thử',
    type: 'FIXED',
    value: 50_000,
    minSubtotal: 500_000,
    startsAt: new Date(Date.now() - 3_600_000).toISOString(),
    endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    active: true,
  };
  let admin: string;
  let staff: string;
  let seller: string;
  /** SELLER không sở hữu shop nào trong đơn: gọi API của CUSTOMER → 403 (sai vai trò). */
  let outsider: string;
  /** CUSTOMER khác: đúng vai trò nhưng không sở hữu đơn → 404 (sai chủ sở hữu). */
  let otherCustomer: string;
  let primaryProduct: string;
  let secondaryProduct: string;

  function api(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, token?: string) {
    const call = request(app.getHttpServer())[method](`/api${path}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  }

  async function createUser(role: string) {
    const entry = await db.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
    const email = `checkout.${run}.${userIds.length}@test.greenshopping.vn`;
    const user = await db.user.create({
      data: {
        email,
        fullName: `E2E ${role}`,
        passwordHash: await hashPassword(password),
        roles: { create: { roleId: entry.id } },
        greenPointAccount: { create: { balance: 500n } },
      },
    });
    userIds.push(user.id);
    const login = await api('post', '/auth/login')
      .send({ identifier: email, password })
      .expect(200);
    return { id: user.id, token: login.body.data.access_token as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    db = app.get(PrismaService);
    admin = (await createUser('ADMIN')).token;
    staff = (await createUser('STAFF')).token;
    const owner = await createUser('SELLER');
    seller = owner.token;
    outsider = (await createUser('SELLER')).token;
    otherCustomer = (await createUser('CUSTOMER')).token;
    for (const [name, price, shippingFee] of [
      ['A', 499_999, 20_000],
      ['B', 1, 10_000],
    ] as const) {
      const shop = await db.shop.create({ data: { name, ownerId: owner.id, shippingFee } });
      shopIds.push(shop.id);
      const product = await db.product.create({
        data: { name: `Sản phẩm ${name}`, shopId: shop.id, price, stock: 20, description: 'E2E' },
      });
      if (name === 'A') primaryProduct = product.id;
      else secondaryProduct = product.id;
    }
    await api('post', '/promotions', staff).send(voucher).expect(403);
    await api('post', '/promotions', admin).send(voucher).expect(201);
  });

  afterAll(async () => {
    try {
      if (!db || !userIds.length) return;
      const orders = { userId: { in: userIds } };
      const subOrders = { masterOrder: orders };
      await db.paymentEvent.deleteMany({ where: { payment: { masterOrder: orders } } });
      await db.payment.deleteMany({ where: { masterOrder: orders } });
      await db.orderStatusEvent.deleteMany({ where: { subOrder: subOrders } });
      await db.shipment.deleteMany({ where: { subOrder: subOrders } });
      await db.orderItem.deleteMany({ where: { subOrder: subOrders } });
      await db.subOrder.deleteMany({ where: subOrders });
      await db.masterOrder.deleteMany({ where: orders });
      await db.cart.deleteMany({ where: orders });
      await db.product.deleteMany({ where: { shopId: { in: shopIds } } });
      await db.shop.deleteMany({ where: { id: { in: shopIds } } });
      await db.promotion.deleteMany({ where: { code: voucherCode } });
      await db.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  });

  it('từ chối voucher ở 499.999đ và kết hợp điểm ở 500.000đ trước phí giao', async () => {
    const buyer = await createUser('CUSTOMER');
    const first = await api('post', '/cart/items', buyer.token)
      .send({ productId: primaryProduct, quantity: 1 })
      .expect(201);
    const ids = [first.body.data.id];
    const low = await api('post', '/checkout/quote', buyer.token)
      .send({ cartItemIds: ids, voucherCode })
      .expect(201);
    expect(low.body.data).toMatchObject({
      subtotal: 499_999,
      shippingFee: 20_000,
      voucherDiscount: 0,
      voucherCode: null,
    });
    expect(low.body.data.promotionError).toMatch(/500.000.*thiếu 1/);
    const second = await api('post', '/cart/items', buyer.token)
      .send({ productId: secondaryProduct, quantity: 1 })
      .expect(201);
    ids.push(second.body.data.id);
    const input = { cartItemIds: ids, voucherCode, points: 15 };
    const valid = await api('post', '/checkout/quote', buyer.token).send(input).expect(201);
    expect(valid.body.data).toMatchObject({
      subtotal: 500_000,
      shippingFee: 30_000,
      voucherDiscount: 50_000,
      pointDiscount: 1_500,
      grandTotal: 478_500,
      promotionError: null,
      pointsError: null,
    });
    expect(
      valid.body.data.shops.reduce(
        (sum: number, shop: { grandTotal: number }) => sum + shop.grandTotal,
        0,
      ),
    ).toBe(478_500);
    const invalid = { ...input, voucherCode: [voucherCode, 'OTHER'] };
    await api('post', '/checkout/quote', buyer.token).send(invalid).expect(400);
    await api('post', '/promotions', buyer.token).send(voucher).expect(403);
  });

  it.each(['FAILED', 'EXPIRED', 'CANCELLED'] as const)(
    'ghi nhận %s, hoàn tồn kho và điểm đúng một lần',
    async (outcome) => {
      const buyer = await createUser('CUSTOMER');
      const item = await api('post', '/cart/items', buyer.token)
        .send({ productId: primaryProduct, quantity: 1 })
        .expect(201);
      const cartItemIds = [item.body.data.id];
      const stock = (await db.product.findUniqueOrThrow({ where: { id: primaryProduct } })).stock;
      const input = {
        cartItemIds,
        points: 10,
        paymentMethod: 'MOCK',
        requestId: randomUUID(),
        expectedTotal: 518_999,
        address,
      };
      const [placed, repeated] = await Promise.all([
        api('post', '/checkout', buyer.token).send(input).expect(201),
        api('post', '/checkout', buyer.token).send(input).expect(201),
      ]);
      const id = placed.body.data.id as string;
      expect(repeated.body.data.id).toBe(id);
      const pending = await db.payment.findUniqueOrThrow({ where: { masterOrderId: id } });
      expect(pending.expiresAt!.getTime() - pending.createdAt.getTime()).toBeCloseTo(900_000, -3);
      expect((await db.product.findUniqueOrThrow({ where: { id: primaryProduct } })).stock).toBe(
        stock - 1,
      );
      if (outcome === 'EXPIRED') {
        await db.payment.update({
          where: { id: pending.id },
          data: { expiresAt: new Date(Date.now() - 1_000) },
        });
      }
      const result = await api('post', `/payments/${id}/mock-result`, buyer.token)
        .send({ outcome: outcome === 'EXPIRED' ? 'SUCCEEDED' : outcome })
        .expect(201);
      expect(result.body.data.status).toBe(outcome);
      const duplicate = await api('post', `/payments/${id}/mock-result`, buyer.token)
        .send({ outcome: 'SUCCEEDED' })
        .expect(201);
      expect(duplicate.body.data.status).toBe(outcome);
      const events = await db.paymentEvent.findMany({
        where: { paymentId: pending.id },
        orderBy: { id: 'asc' },
      });
      expect(events.map((event) => event.status)).toEqual(['PENDING', outcome]);
      expect(
        (await db.greenPointAccount.findUniqueOrThrow({ where: { userId: buyer.id } })).balance,
      ).toBe(500n);
      expect((await db.product.findUniqueOrThrow({ where: { id: primaryProduct } })).stock).toBe(
        stock,
      );
      const cart = await api('get', '/cart', buyer.token).expect(200);
      expect(cart.body.data.map((row: { id: string }) => row.id)).toEqual(cartItemIds);
      // QA-03: RolesGuard chặn SELLER trước khi kiểm chủ sở hữu (403); CUSTOMER khác không thấy đơn (404)
      await api('get', `/orders/${id}`, outsider).expect(403);
      await api('get', `/orders/${id}`, otherCustomer).expect(404);
      await api('get', '/payments/manage', buyer.token).expect(403);
      const management = await api('get', `/payments/manage?status=${outcome}`, admin).expect(200);
      expect(management.body.data.items).toContainEqual(
        expect.objectContaining({ id: pending.id, status: outcome }),
      );
    },
  );

  it('mua ngay thành công giữ giỏ hàng và ghi nhận thành công theo quyền sở hữu', async () => {
    const buyer = await createUser('CUSTOMER');
    await api('post', '/cart/items', buyer.token)
      .send({ productId: primaryProduct, quantity: 1 })
      .expect(201);
    const result = await api('post', '/checkout', buyer.token)
      .send({
        buyNow: { productId: primaryProduct, quantity: 2 },
        paymentMethod: 'MOCK',
        requestId: randomUUID(),
        expectedTotal: 968_498,
        address,
        voucherCode,
        points: 15,
      })
      .expect(201);
    const id = result.body.data.id;
    // QA-03: xác nhận thanh toán trước giao — đơn online chưa thanh toán chưa thể chuyển mốc giao hàng
    const pendingOrder = (await api('get', `/orders/${id}`, buyer.token).expect(200)).body.data;
    expect(pendingOrder.status).toBe('AWAITING_PAYMENT');
    await api('patch', `/shipments/${pendingOrder.subOrders[0].id}/status`, seller)
      .send({ expectedStatus: 'PROCESSING', status: 'READY' })
      .expect(404);
    // QA-03: SELLER gọi API của CUSTOMER → 403; CUSTOMER khác trả kết quả cho đơn không phải của mình → 404
    await api('post', `/payments/${id}/mock-result`, outsider)
      .send({ outcome: 'SUCCEEDED' })
      .expect(403);
    await api('post', `/payments/${id}/mock-result`, otherCustomer)
      .send({ outcome: 'SUCCEEDED' })
      .expect(404);
    const paid = await api('post', `/payments/${id}/mock-result`, buyer.token)
      .send({ outcome: 'SUCCEEDED' })
      .expect(201);
    expect(paid.body.data.status).toBe('SUCCEEDED');
    const cart = await api('get', '/cart', buyer.token).expect(200);
    expect(cart.body.data).toHaveLength(1);
    expect(
      (await db.greenPointAccount.findUniqueOrThrow({ where: { userId: buyer.id } })).balance,
    ).toBe(485n);
    const order = await api('get', `/orders/${id}`, buyer.token).expect(200);
    expect(order.body.data.status).toBe('PROCESSING');
  });

  it('tách đơn COD theo shop, lưu lịch sử và chỉ chuyển COD sang chờ đối soát khi giao đủ', async () => {
    const buyer = await createUser('CUSTOMER');
    for (const productId of [primaryProduct, secondaryProduct]) {
      await api('post', '/cart/items', buyer.token).send({ productId, quantity: 1 }).expect(201);
    }
    const placed = await api('post', '/checkout', buyer.token)
      .send({
        voucherCode,
        paymentMethod: 'COD',
        requestId: randomUUID(),
        expectedTotal: 480_000,
        address,
        ecoShopIds: [shopIds[0]],
      })
      .expect(201);
    const id = placed.body.data.id as string;
    const customerOrder = () => api('get', `/orders/${id}`, buyer.token).expect(200);
    const initial = (await customerOrder()).body.data;
    expect(initial.subOrders).toHaveLength(2);
    expect(initial.payment).toMatchObject({ status: 'PENDING', expiresAt: null });
    const [first, second] = initial.subOrders as { id: string }[];
    const move = (token: string, target: string, expectedStatus: string, status: string) =>
      api('patch', `/shipments/${target}/status`, token).send({ expectedStatus, status });
    await move(outsider, first.id, 'PROCESSING', 'READY').expect(404);
    await move(seller, first.id, 'PROCESSING', 'DELIVERED').expect(400);
    for (const [target, token] of [
      [first.id, seller],
      [second.id, staff],
    ] as const) {
      const ready = await move(token, target, 'PROCESSING', 'READY').expect(200);
      expect(ready.body.data.shipment.trackingCode).toMatch(/^SIM-/);
      await move(token, target, 'READY', 'IN_TRANSIT').expect(200);
      await move(token, target, 'IN_TRANSIT', 'OUT_FOR_DELIVERY').expect(200);
    }
    await move(seller, first.id, 'OUT_FOR_DELIVERY', 'DELIVERED').expect(200);
    expect((await customerOrder()).body.data.payment.status).toBe('PENDING');
    await move(staff, second.id, 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED').expect(200);
    expect((await customerOrder()).body.data.status).toBe('DELIVERY_ISSUE');
    await move(staff, second.id, 'DELIVERY_FAILED', 'IN_TRANSIT').expect(200);
    await move(staff, second.id, 'IN_TRANSIT', 'OUT_FOR_DELIVERY').expect(200);
    await move(staff, second.id, 'OUT_FOR_DELIVERY', 'DELIVERED').expect(200);
    const delivered = (await customerOrder()).body.data;
    expect(delivered.status).toBe('COMPLETED');
    // NV-01: giao đủ không đồng nghĩa đã nhận tiền → chờ đối soát thủ công, chưa có resolvedAt
    expect(delivered.payment).toMatchObject({
      status: 'PENDING_MANUAL_RECONCILIATION',
      resolvedAt: null,
    });
    expect(
      delivered.subOrders.find((shop: { id: string }) => shop.id === second.id).history,
    ).toHaveLength(8);
  });
});
