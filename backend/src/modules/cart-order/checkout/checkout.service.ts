import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PAYMENT_WINDOW_MS,
  PaymentsService,
  clearPurchasedCartItems,
} from '../../payment-refund/payments/payments.service';
import { lockCustomer } from '../cart/cart.service';
import { CheckoutValidationService } from './checkout-validation.service';
import type { CheckoutDto, QuoteDto } from './dto/checkout.dto';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly db: PrismaService,
    private readonly validation: CheckoutValidationService,
    private readonly payments: PaymentsService,
  ) {}

  async quote(userId: string, input: QuoteDto) {
    await this.payments.expirePending(userId);
    return this.validation.quote(userId, input);
  }

  async place(userId: string, input: CheckoutDto) {
    await this.payments.expirePending(userId);
    const { requestId, address, paymentMethod } = input;
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify([
          Object.values(addressInput(address)),
          paymentMethod,
          input.expectedTotal,
          input.buyNow?.productId,
          input.buyNow?.quantity,
          input.cartItemIds?.toSorted(),
          input.voucherCode?.toUpperCase(),
          input.points ?? 0,
          input.ecoShopIds?.toSorted() ?? [],
        ]),
      )
      .digest('hex');
    return this.db.$transaction(
      async (db) => {
        await lockCustomer(db, userId);
        const prior = await db.masterOrder.findUnique({
          where: { userId_requestId: { userId, requestId } },
        });
        if (prior) {
          if (prior.requestHash !== requestHash)
            throw new ConflictException('Yêu cầu đặt hàng đã được sử dụng.');
          return { id: prior.id };
        }

        const quote = await this.validation.quote(userId, input, db);
        if (quote.promotionError || quote.pointsError) {
          throw new BadRequestException(quote.promotionError ?? quote.pointsError);
        }
        if (input.expectedTotal !== quote.grandTotal) {
          throw new ConflictException('Tổng thanh toán đã thay đổi. Vui lòng kiểm tra lại đơn.');
        }
        const ecoShops = new Set(input.ecoShopIds);
        if ([...ecoShops].some((id) => !quote.shops.some((shop) => shop.shopId === id))) {
          throw new BadRequestException('Lựa chọn đóng gói không khớp với cửa hàng trong đơn.');
        }
        const items = quote.shops.flatMap((shop) => shop.items);
        const cartIds = items.flatMap((item) => (item.cartItemId ? [item.cartItemId] : []));
        const heldInOrder = cartIds.length
          ? await db.orderItem.findFirst({
              where: {
                sourceCartItemId: { in: cartIds },
                subOrder: { masterOrder: { userId, status: 'AWAITING_PAYMENT' } },
              },
              select: { id: true },
            })
          : null;
        if (heldInOrder) {
          throw new ConflictException(
            'Mặt hàng đã có trong đơn chờ thanh toán. Vui lòng kiểm tra Đơn hàng của bạn.',
          );
        }

        // Conditional writes reserve stock without overselling when different customers buy the same product.
        for (const item of items.toSorted((a, b) => a.productId.localeCompare(b.productId))) {
          const reserved = await db.product.updateMany({
            where: {
              id: item.productId,
              price: item.unitPrice,
              stock: { gte: item.quantity },
              active: true,
              shop: { active: true },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (!reserved.count)
            throw new ConflictException(`Giá hoặc tồn kho của ${item.name} đã thay đổi.`);
        }
        if (quote.pointsUsed) {
          const debit = await db.greenPointAccount.updateMany({
            where: { userId, balance: { gte: BigInt(quote.pointsUsed) } },
            data: { balance: { decrement: BigInt(quote.pointsUsed) } },
          });
          if (!debit.count) throw new ConflictException('Số dư Điểm xanh đã thay đổi.');
        }

        const now = new Date();
        const isFree = quote.grandTotal === 0;
        const waiting = paymentMethod === 'MOCK' && !isFree;
        const status = waiting ? 'AWAITING_PAYMENT' : 'PROCESSING';
        const paymentStatus = isFree ? 'SUCCEEDED' : 'PENDING';
        const order = await db.masterOrder.create({
          data: {
            userId,
            requestId,
            requestHash,
            status,
            ...addressInput(address),
            subtotal: quote.subtotal,
            shippingFee: quote.shippingFee,
            voucherCode: quote.voucherCode,
            voucherDiscount: quote.voucherDiscount,
            pointsUsed: quote.pointsUsed,
            pointDiscount: quote.pointDiscount,
            grandTotal: quote.grandTotal,
            payment: {
              create: {
                method: paymentMethod,
                amount: quote.grandTotal,
                status: paymentStatus,
                expiresAt: waiting ? new Date(now.getTime() + PAYMENT_WINDOW_MS) : null,
                resolvedAt: isFree ? now : null,
                events: { create: { status: paymentStatus } },
              },
            },
            subOrders: {
              create: quote.shops.map(({ items, ...shop }) => ({
                ...shop,
                status,
                ecoPackaging: ecoShops.has(shop.shopId),
                history: { create: { status } },
                items: {
                  create: items.map((item) => ({
                    productId: item.productId,
                    productName: item.name,
                    imageUrl: item.imageUrl,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    sourceCartItemId: item.cartItemId,
                    sourceCartRevision: item.cartRevision,
                  })),
                },
              })),
            },
          },
          select: { id: true },
        });
        if (!waiting) await clearPurchasedCartItems(db, userId, order.id);
        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}

function addressInput(address: CheckoutDto['address']) {
  return {
    recipientName: address.recipientName,
    phone: address.phone,
    province: address.province,
    ward: address.ward,
    addressLine: address.addressLine,
  };
}
