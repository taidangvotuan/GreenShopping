import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  evaluatePromotion,
  type PromotionEvaluation,
} from '../../promotion/promotions/promotions.service';
import { CartService, checkStock } from '../cart/cart.service';
import { MAX_POINTS, MAX_TOTAL, type QuoteDto } from './dto/checkout.dto';
import { splitDiscounts } from './order-split.service';

export const POINT_VALUE = 100;

export interface QuoteLine {
  cartItemId: string | null;
  cartRevision: number | null;
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
}
type ShopGroup = {
  shopId: string;
  shopName: string;
  shippingFee: number;
  subtotal: number;
  items: QuoteLine[];
};

@Injectable()
export class CheckoutValidationService {
  constructor(
    private readonly db: PrismaService,
    private readonly cart: CartService,
  ) {}

  async quote(userId: string, input: QuoteDto, db: Prisma.TransactionClient = this.db) {
    if (input.buyNow && input.cartItemIds) {
      throw new BadRequestException('Chọn mua ngay hoặc thanh toán từ giỏ hàng.');
    }

    const rows = input.buyNow
      ? [
          {
            id: null,
            revision: null,
            quantity: input.buyNow.quantity,
            product: await this.cart.product(input.buyNow.productId, db),
          },
        ]
      : await this.cart.list(userId, db, input.cartItemIds);
    if (input.cartItemIds && rows.length !== input.cartItemIds.length) {
      throw new BadRequestException('Giỏ hàng đã thay đổi. Vui lòng chọn lại sản phẩm.');
    }
    if (!rows.length) throw new BadRequestException('Vui lòng chọn sản phẩm để thanh toán.');

    const groups = new Map<string, ShopGroup>();
    for (const row of rows) {
      const product = row.product;
      checkStock(product, row.quantity);
      const shop = product.shop;
      let group = groups.get(shop.id);
      if (!group) {
        group = {
          shopId: shop.id,
          shopName: shop.name,
          subtotal: 0,
          shippingFee: Number(shop.shippingFee),
          items: [],
        };
        groups.set(shop.id, group);
      }
      const unitPrice = Number(product.price);
      group.subtotal += unitPrice * row.quantity;
      group.items.push({
        cartItemId: row.id,
        cartRevision: row.revision,
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        quantity: row.quantity,
        unitPrice,
      });
    }

    const shops = [...groups.values()];
    const subtotal = shops.reduce((sum, shop) => sum + shop.subtotal, 0);
    const shippingFee = shops.reduce((sum, shop) => sum + shop.shippingFee, 0);
    if (!Number.isSafeInteger(subtotal + shippingFee) || subtotal + shippingFee > MAX_TOTAL) {
      throw new BadRequestException('Giá trị đơn hàng vượt giới hạn.');
    }

    const code = input.voucherCode?.toUpperCase();
    // Tối đa 1 voucher / đơn: DTO chỉ nhận MỘT voucherCode (chuỗi), không nhận mảng.
    const promo: PromotionEvaluation = code
      ? evaluatePromotion(await db.promotion.findUnique({ where: { code } }), subtotal, new Date())
      : { code: null, discount: 0, error: null, minSubtotal: null, shortfall: 0 };
    const account = await db.greenPointAccount.findUnique({
      where: { userId },
      select: { balance: true },
    });
    const balance = account?.balance ?? 0n;
    const pointLimit = Math.min(
      Number(balance),
      MAX_POINTS,
      Math.floor((subtotal - promo.discount) / POINT_VALUE),
    );

    const requestedPoints = input.points ?? 0;
    const pointsError =
      requestedPoints > pointLimit
        ? requestedPoints > balance
          ? 'Số dư Điểm xanh không đủ.'
          : `Tối đa ${pointLimit.toLocaleString('vi-VN')} Điểm xanh cho đơn này sau khi áp voucher.`
        : null;
    const pointsUsed = pointsError ? 0 : requestedPoints;
    const pointDiscount = pointsUsed * POINT_VALUE;

    return {
      shops: splitDiscounts(shops, subtotal, promo.discount, pointDiscount),
      subtotal,
      shippingFee,
      voucherCode: promo.code,
      voucherDiscount: promo.discount,
      promotionError: promo.error,
      promotionMinSubtotal: promo.minSubtotal,
      promotionShortfall: promo.shortfall,
      pointsError,
      pointsUsed,
      pointDiscount,
      pointBalance: balance.toString(),
      pointValue: POINT_VALUE,
      pointLimit,
      grandTotal: subtotal + shippingFee - promo.discount - pointDiscount,
    };
  }
}
