import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../src/common/interfaces/authenticated-request.interface';
import { ShipmentsService } from '../../src/modules/shipment-carbon/shipments/shipments.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

const SUB_ORDER_ID = '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b';
const MASTER_ORDER_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

const staff: AuthenticatedUser = {
  userId: '0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  email: 'staff@test.greenshopping.vn',
  roles: ['STAFF'],
  permissions: [],
  jti: '3f9c5a8e-1d2b-4c6f-8a7e-9b0c1d2e3f40',
  tokenExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

function setup(options: {
  status: string;
  payment: { method: string; status: string };
  siblings: string[];
  masterPayment?: { id: string; method: string; status: string };
}) {
  const db = {
    $queryRaw: jest.fn(),
    subOrder: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ masterOrderId: MASTER_ORDER_ID })
        .mockResolvedValueOnce({
          id: SUB_ORDER_ID,
          masterOrderId: MASTER_ORDER_ID,
          status: options.status,
          masterOrder: { payment: options.payment },
        }),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue(options.siblings.map((status) => ({ status }))),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: SUB_ORDER_ID }),
    },
    masterOrder: {
      update: jest.fn().mockResolvedValue({
        payment: options.masterPayment ?? { id: 'payment-1', ...options.payment },
      }),
    },
    payment: { update: jest.fn() },
  };
  Object.assign(db, { $transaction: jest.fn((fn: (client: typeof db) => unknown) => fn(db)) });
  const service = new ShipmentsService(db as unknown as PrismaService);
  return { service, db };
}

describe('ShipmentsService.update — đồng bộ thanh toán ↔ giao hàng', () => {
  it('NV-01: COD giao xong đơn con cuối → đơn COMPLETED, thanh toán chuyển PENDING_MANUAL_RECONCILIATION (không SUCCEEDED)', async () => {
    const { service, db } = setup({
      status: 'OUT_FOR_DELIVERY',
      payment: { method: 'COD', status: 'PENDING' },
      siblings: ['DELIVERED', 'DELIVERED'],
    });

    await service.update(staff, SUB_ORDER_ID, {
      expectedStatus: 'OUT_FOR_DELIVERY',
      status: 'DELIVERED',
    });

    expect(db.masterOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'COMPLETED' } }),
    );
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: {
        status: 'PENDING_MANUAL_RECONCILIATION',
        events: { create: { status: 'PENDING_MANUAL_RECONCILIATION' } },
      },
    });
    const { data } = db.payment.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('resolvedAt');
  });

  it('COD còn đơn con chưa giao → chưa đụng tới trạng thái thanh toán', async () => {
    const { service, db } = setup({
      status: 'OUT_FOR_DELIVERY',
      payment: { method: 'COD', status: 'PENDING' },
      siblings: ['DELIVERED', 'IN_TRANSIT'],
    });

    await service.update(staff, SUB_ORDER_ID, {
      expectedStatus: 'OUT_FOR_DELIVERY',
      status: 'DELIVERED',
    });

    expect(db.payment.update).not.toHaveBeenCalled();
  });

  it('đơn online (MOCK) chưa thanh toán thành công → 409, không cập nhật vận chuyển', async () => {
    const { service, db } = setup({
      status: 'PROCESSING',
      payment: { method: 'MOCK', status: 'PENDING' },
      siblings: ['PROCESSING'],
    });

    await expect(
      service.update(staff, SUB_ORDER_ID, { expectedStatus: 'PROCESSING', status: 'READY' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.subOrder.update).not.toHaveBeenCalled();
  });

  it('đơn con đang chờ thanh toán → 404 (không nằm trong phạm vi giao hàng)', async () => {
    const { service, db } = setup({
      status: 'AWAITING_PAYMENT',
      payment: { method: 'MOCK', status: 'PENDING' },
      siblings: ['AWAITING_PAYMENT'],
    });

    await expect(
      service.update(staff, SUB_ORDER_ID, { expectedStatus: 'PROCESSING', status: 'READY' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.subOrder.update).not.toHaveBeenCalled();
  });
});
