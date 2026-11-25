import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type PaymentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { lockCustomer } from '../../cart-order/cart/cart.service';

export const PAYMENT_WINDOW_MS = 15 * 60_000;
export type MockPaymentOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

/** NV-01: thông báo khi cổng thanh toán mô phỏng bị tắt (PAYMENT_MOCK_ENABLED khác "true"). */
export const MOCK_PAYMENT_DISABLED_MESSAGE =
  'Cổng thanh toán mô phỏng không khả dụng trong môi trường này.';

export async function clearPurchasedCartItems(
  db: Prisma.TransactionClient,
  userId: string,
  orderId: string,
) {
  const items = await db.orderItem.findMany({
    where: { subOrder: { masterOrderId: orderId }, sourceCartItemId: { not: null } },
    select: { sourceCartItemId: true, sourceCartRevision: true },
  });
  if (items.length) {
    await db.cartItem.deleteMany({
      where: {
        cart: { userId },
        OR: items.map((item) => ({
          id: item.sourceCartItemId!,
          revision: item.sourceCartRevision!,
        })),
      },
    });
  }
}

export async function recordPaymentStatus(
  db: Prisma.TransactionClient,
  paymentId: string,
  status: PaymentStatus,
  now = new Date(),
) {
  return db.payment.update({
    where: { id: paymentId },
    data: { status, resolvedAt: now, events: { create: { status } } },
  });
}

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  /**
   * SECURITY (NV-01): cổng mô phỏng chỉ hoạt động khi PAYMENT_MOCK_ENABLED=true (mặc định false).
   * Bộ quét giao dịch hết hạn vẫn chạy để dọn các đơn MOCK tạo trước khi tắt cờ (hoàn kho/điểm).
   */
  readonly mockEnabled: boolean;

  constructor(
    private readonly db: PrismaService,
    config: ConfigService,
  ) {
    this.mockEnabled = config.get<boolean>('PAYMENT_MOCK_ENABLED') === true;
  }

  onModuleInit() {
    this.timer = setInterval(() => void this.sweepExpired(), 15_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweepExpired() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      await this.expirePending();
    } catch (error) {
      this.logger.error('Không thể cập nhật các giao dịch hết hạn', error);
    } finally {
      this.sweeping = false;
    }
  }

  async expirePending(userId?: string, id?: string) {
    const pending = await this.db.payment.findMany({
      where: {
        status: 'PENDING',
        method: 'MOCK',
        expiresAt: { lte: new Date() },
        masterOrder: { id, userId },
      },
      select: { masterOrder: { select: { userId: true, id: true } } },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
    for (const { masterOrder } of pending) {
      await this.resolve(masterOrder.userId, masterOrder.id);
    }
  }

  async manage(page: number, status?: PaymentStatus) {
    await this.expirePending();
    const where = { status };
    const [items, total] = await this.db.$transaction([
      this.db.payment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 25,
        skip: (page - 1) * 25,
        include: {
          masterOrder: { select: { id: true, recipientName: true, status: true } },
          events: { select: { id: true, status: true, createdAt: true }, orderBy: { id: 'asc' } },
        },
      }),
      this.db.payment.count({ where }),
    ]);
    return { items, total, pageSize: 25 };
  }

  resolve(userId: string, orderId: string, outcome?: MockPaymentOutcome) {
    return this.db.$transaction(
      async (db) => {
        await lockCustomer(db, userId);
        const order = await db.masterOrder.findFirst({
          where: { id: orderId, userId },
          include: { payment: true },
        });
        if (!order?.payment || order.payment.method !== 'MOCK') {
          throw new NotFoundException('Không tìm thấy giao dịch online của đơn hàng.');
        }
        const payment = order.payment;
        if (payment.status !== 'PENDING') return payment;

        const now = new Date();
        const status = payment.expiresAt && payment.expiresAt <= now ? 'EXPIRED' : outcome;
        if (!status) return payment;
        const succeeded = status === 'SUCCEEDED';
        const subStatus = succeeded ? 'PROCESSING' : 'CANCELLED';
        const subOrders = await db.subOrder.findMany({
          where: { masterOrderId: order.id },
          include: { items: true },
        });

        if (succeeded) {
          await clearPurchasedCartItems(db, userId, orderId);
        } else {
          const items = subOrders.flatMap((subOrder) => subOrder.items);
          for (const item of items.toSorted((a, b) => a.productId.localeCompare(b.productId))) {
            await db.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
          if (order.pointsUsed) {
            await db.greenPointAccount.update({
              where: { userId },
              data: { balance: { increment: BigInt(order.pointsUsed) } },
            });
          }
        }

        await db.masterOrder.update({ where: { id: orderId }, data: { status: subStatus } });
        await db.subOrder.updateMany({
          where: { masterOrderId: orderId },
          data: { status: subStatus },
        });
        await db.orderStatusEvent.createMany({
          data: subOrders.map(({ id }) => ({ subOrderId: id, status: subStatus })),
        });
        return recordPaymentStatus(db, payment.id, status, now);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
