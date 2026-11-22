import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { Prisma, type SubOrderStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { rollUpOrder, shipmentTransitions } from '../../cart-order/sub-orders/sub-order.fsm';
import { recordPaymentStatus } from '../../payment-refund/payments/payments.service';
import type { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

const include = {
  masterOrder: {
    select: {
      id: true,
      recipientName: true,
      phone: true,
      province: true,
      ward: true,
      addressLine: true,
      payment: { select: { method: true } },
    },
  },
  shipment: { select: { trackingCode: true } },
  items: { select: { productName: true, quantity: true } },
  history: {
    orderBy: { id: 'asc' },
    select: { id: true, status: true, note: true, createdAt: true },
  },
} as const;

function scope(user: AuthenticatedUser): Prisma.SubOrderWhereInput {
  const canManageAll = user.roles.some((role) => role === 'ADMIN' || role === 'STAFF');
  return { shop: canManageAll ? undefined : { ownerId: user.userId } };
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly db: PrismaService) {}

  async list(user: AuthenticatedUser, page: number, status?: SubOrderStatus) {
    const where: Prisma.SubOrderWhereInput = {
      ...scope(user),
      status: { equals: status, notIn: ['AWAITING_PAYMENT', 'CANCELLED'] },
    };
    const [items, total] = await this.db.$transaction([
      this.db.subOrder.findMany({
        where,
        include,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 25,
        skip: (page - 1) * 25,
      }),
      this.db.subOrder.count({ where }),
    ]);
    return { items, total, pageSize: 25 };
  }

  async update(user: AuthenticatedUser, id: string, input: UpdateShipmentStatusDto) {
    const target = await this.db.subOrder.findFirst({
      where: { id, ...scope(user) },
      select: { masterOrderId: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy đơn con trong phạm vi quản lý.');
    return this.db.$transaction(
      async (db) => {
        // Concurrent updates for different shops of one order must roll up in sequence.
        await db.$queryRaw`SELECT master_order_id FROM master_order WHERE master_order_id = ${target.masterOrderId} FOR UPDATE`;
        const order = await db.subOrder.findFirst({ where: { id, ...scope(user) } });
        if (!order || order.status === 'AWAITING_PAYMENT' || order.status === 'CANCELLED') {
          throw new NotFoundException('Không tìm thấy đơn con trong phạm vi quản lý.');
        }
        if (order.status === input.status) return this.detail(db, id);
        if (order.status !== input.expectedStatus) {
          throw new ConflictException('Trạng thái đã thay đổi. Vui lòng tải lại dữ liệu.');
        }
        if (!shipmentTransitions[order.status].includes(input.status)) {
          throw new BadRequestException(
            'Không thể chuyển sang mốc giao hàng này từ trạng thái hiện tại.',
          );
        }

        await db.subOrder.update({
          where: { id },
          data: {
            status: input.status,
            history: {
              create: {
                status: input.status,
                actorUserId: user.userId,
                note: input.note || undefined,
              },
            },
            shipment:
              input.status === 'READY'
                ? { create: { trackingCode: `SIM-${id.toUpperCase()}` } }
                : undefined,
          },
        });

        const siblings = await db.subOrder.findMany({
          where: { masterOrderId: order.masterOrderId },
          select: { status: true },
        });
        const status = rollUpOrder(siblings.map((subOrder) => subOrder.status));
        const master = await db.masterOrder.update({
          where: { id: order.masterOrderId },
          data: { status },
          select: { payment: true },
        });
        if (
          status === 'COMPLETED' &&
          master.payment?.method === 'COD' &&
          master.payment.status === 'PENDING'
        ) {
          await recordPaymentStatus(db, master.payment.id, 'SUCCEEDED');
        }
        return this.detail(db, id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async detail(db: Prisma.TransactionClient, id: string) {
    return db.subOrder.findUniqueOrThrow({ where: { id }, include });
  }
}
