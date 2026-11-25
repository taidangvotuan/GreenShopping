import { ForbiddenException } from '@nestjs/common';
import type { CheckoutValidationService } from '../../src/modules/cart-order/checkout/checkout-validation.service';
import { CheckoutService } from '../../src/modules/cart-order/checkout/checkout.service';
import type { CheckoutDto } from '../../src/modules/cart-order/checkout/dto/checkout.dto';
import type { PaymentsService } from '../../src/modules/payment-refund/payments/payments.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

const USER_ID = '7d4f6f0e-2a59-4a8e-9a43-0b6f3f6b1c11';

const input = (paymentMethod: 'MOCK' | 'COD'): CheckoutDto => ({
  requestId: '5b8f1e2a-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  paymentMethod,
  expectedTotal: 319_000,
  cartItemIds: ['9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'],
  address: {
    recipientName: 'Người nhận',
    phone: '0901234567',
    province: 'TP Hồ Chí Minh',
    ward: 'Phường Bến Thành',
    addressLine: '01 Lê Lợi',
  },
});

function setup(mockEnabled: boolean) {
  const db = { $transaction: jest.fn().mockResolvedValue({ id: 'order-1' }) };
  const payments = { mockEnabled, expirePending: jest.fn() };
  const service = new CheckoutService(
    db as unknown as PrismaService,
    {} as CheckoutValidationService,
    payments as unknown as PaymentsService,
  );
  return { service, db, payments };
}

describe('CheckoutService.place — cờ PAYMENT_MOCK_ENABLED (NV-01)', () => {
  it('cờ tắt + phương thức MOCK → 403, không tạo đơn/giữ hàng', async () => {
    const { service, db, payments } = setup(false);

    await expect(service.place(USER_ID, input('MOCK'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(payments.expirePending).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('cờ tắt + COD → vẫn đặt hàng bình thường', async () => {
    const { service, db } = setup(false);

    await expect(service.place(USER_ID, input('COD'))).resolves.toEqual({ id: 'order-1' });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('cờ bật + MOCK → đi tiếp vào transaction đặt hàng', async () => {
    const { service, db, payments } = setup(true);

    await expect(service.place(USER_ID, input('MOCK'))).resolves.toEqual({ id: 'order-1' });
    expect(payments.expirePending).toHaveBeenCalledWith(USER_ID);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
