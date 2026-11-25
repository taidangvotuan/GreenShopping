import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PaymentsController } from '../../src/modules/payment-refund/payments/payments.controller';
import { PaymentsService } from '../../src/modules/payment-refund/payments/payments.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

const USER_ID = '7d4f6f0e-2a59-4a8e-9a43-0b6f3f6b1c11';
const ORDER_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

const configWith = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

function pendingPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    method: 'MOCK',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 10 * 60_000),
    ...overrides,
  };
}

function setup(payment: Record<string, unknown> | null = pendingPayment(), pointsUsed = 0) {
  const tx = {
    $queryRaw: jest.fn(),
    masterOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: ORDER_ID, userId: USER_ID, pointsUsed, payment }),
      update: jest.fn(),
    },
    subOrder: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'sub-b', items: [{ productId: 'product-b', quantity: 1 }] },
        { id: 'sub-a', items: [{ productId: 'product-a', quantity: 2 }] },
      ]),
      updateMany: jest.fn(),
    },
    orderItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ sourceCartItemId: 'cart-item-1', sourceCartRevision: 3 }]),
    },
    cartItem: { deleteMany: jest.fn() },
    product: { update: jest.fn() },
    greenPointAccount: { update: jest.fn() },
    orderStatusEvent: { createMany: jest.fn() },
    payment: { update: jest.fn((args: { data: { status: string } }) => args.data) },
  };
  const db = { $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
  const service = new PaymentsService(
    db as unknown as PrismaService,
    configWith({ PAYMENT_MOCK_ENABLED: true }),
  );
  return { service, tx };
}

describe('PAYMENT_MOCK_ENABLED (NV-01)', () => {
  it.each([
    [true, true],
    [false, false],
    [undefined, false],
  ])('cấu hình %s → mockEnabled=%s (mặc định tắt)', (flag, expected) => {
    const service = new PaymentsService({} as PrismaService, configWith({ PAYMENT_MOCK_ENABLED: flag }));
    expect(service.mockEnabled).toBe(expected);
  });

  it('cờ tắt → POST /payments/:orderId/mock-result trả 404 và không chạm giao dịch', () => {
    const service = { mockEnabled: false, resolve: jest.fn() };
    const controller = new PaymentsController(service as unknown as PaymentsService);

    expect(() => controller.mockResult(USER_ID, ORDER_ID, { outcome: 'SUCCEEDED' })).toThrow(
      NotFoundException,
    );
    expect(service.resolve).not.toHaveBeenCalled();
  });

  it('cờ bật → chuyển kết quả mock cho PaymentsService.resolve', async () => {
    const service = { mockEnabled: true, resolve: jest.fn().mockResolvedValue({ status: 'FAILED' }) };
    const controller = new PaymentsController(service as unknown as PaymentsService);

    await expect(controller.mockResult(USER_ID, ORDER_ID, { outcome: 'FAILED' })).resolves.toEqual({
      status: 'FAILED',
    });
    expect(service.resolve).toHaveBeenCalledWith(USER_ID, ORDER_ID, 'FAILED');
  });
});

describe('PaymentsService.resolve', () => {
  it('SUCCEEDED: khóa theo khách, xóa dòng giỏ đã mua, đơn → PROCESSING, ghi sự kiện thanh toán', async () => {
    const { service, tx } = setup();

    await expect(service.resolve(USER_ID, ORDER_ID, 'SUCCEEDED')).resolves.toMatchObject({
      status: 'SUCCEEDED',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cart: { userId: USER_ID }, OR: [{ id: 'cart-item-1', revision: 3 }] },
    });
    expect(tx.masterOrder.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { status: 'PROCESSING' },
    });
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'SUCCEEDED', resolvedAt: expect.any(Date), events: { create: { status: 'SUCCEEDED' } } },
    });
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('FAILED: hoàn tồn kho từng dòng (theo thứ tự productId), hoàn Điểm xanh, đơn → CANCELLED', async () => {
    const { service, tx } = setup(pendingPayment(), 15);

    await service.resolve(USER_ID, ORDER_ID, 'FAILED');

    expect(tx.product.update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: 'product-a' }, data: { stock: { increment: 2 } } },
      { where: { id: 'product-b' }, data: { stock: { increment: 1 } } },
    ]);
    expect(tx.greenPointAccount.update).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { balance: { increment: 15n } },
    });
    expect(tx.subOrder.updateMany).toHaveBeenCalledWith({
      where: { masterOrderId: ORDER_ID },
      data: { status: 'CANCELLED' },
    });
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it('quá hạn thanh toán → EXPIRED dù client gửi SUCCEEDED', async () => {
    const { service, tx } = setup(pendingPayment({ expiresAt: new Date(Date.now() - 1_000) }));

    await expect(service.resolve(USER_ID, ORDER_ID, 'SUCCEEDED')).resolves.toMatchObject({
      status: 'EXPIRED',
    });
    expect(tx.product.update).toHaveBeenCalled();
  });

  it('giao dịch đã có kết quả → trả nguyên trạng, không ghi lặp (idempotent)', async () => {
    const settled = pendingPayment({ status: 'FAILED' });
    const { service, tx } = setup(settled);

    await expect(service.resolve(USER_ID, ORDER_ID, 'SUCCEEDED')).resolves.toBe(settled);
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.masterOrder.update).not.toHaveBeenCalled();
  });

  it.each([
    ['không có giao dịch (đơn của khách khác / không tồn tại)', null],
    ['giao dịch COD', pendingPayment({ method: 'COD' })],
  ])('%s → 404', async (_label, payment) => {
    const { service } = setup(payment);

    await expect(service.resolve(USER_ID, ORDER_ID, 'SUCCEEDED')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
