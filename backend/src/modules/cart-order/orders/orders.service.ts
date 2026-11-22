import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentsService } from '../../payment-refund/payments/payments.service';

const paymentSummary = { method: true, status: true, expiresAt: true, resolvedAt: true } as const;
const subOrderDetail = {
  items: { omit: { sourceCartRevision: true } },
  shipment: { select: { trackingCode: true } },
  history: {
    orderBy: { id: 'asc' },
    select: { id: true, status: true, note: true, createdAt: true },
  },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async list(userId: string, page: number) {
    await this.payments.expirePending(userId);
    const where = { userId };
    const [items, total] = await this.db.$transaction([
      this.db.masterOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 25,
        skip: (page - 1) * 25,
        select: {
          id: true,
          status: true,
          grandTotal: true,
          createdAt: true,
          payment: { select: paymentSummary },
          subOrders: {
            select: {
              id: true,
              shopName: true,
              status: true,
              items: { select: { productName: true, quantity: true } },
            },
          },
        },
      }),
      this.db.masterOrder.count({ where }),
    ]);
    return { items, total, pageSize: 25 };
  }

  async detail(userId: string, id: string) {
    await this.payments.expirePending(userId, id);
    const order = await this.db.masterOrder.findFirst({
      where: { id, userId },
      omit: { requestHash: true, requestId: true, userId: true },
      include: {
        payment: { select: paymentSummary },
        subOrders: { include: subOrderDetail, orderBy: { id: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return { ...order, serverTime: new Date() };
  }
}
