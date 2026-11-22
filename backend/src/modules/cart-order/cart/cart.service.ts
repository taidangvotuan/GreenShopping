import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MAX_CART_LINES } from '../checkout/dto/checkout.dto';
import type { AddCartItemDto } from './dto/add-cart-item.dto';

const productInclude = {
  shop: { select: { id: true, name: true, shippingFee: true, active: true } },
} as const;
export type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function checkStock(product: CatalogProduct, quantity: number) {
  if (!product.active || !product.shop.active) {
    throw new BadRequestException(`${product.name} hiện ngừng bán.`);
  }
  if (quantity > product.stock || quantity > 99) {
    throw new BadRequestException(
      `${product.name} còn ${product.stock} sản phẩm. Mỗi giỏ hàng tối đa 99 sản phẩm cùng loại.`,
    );
  }
}

// Serialize cart and checkout writes for the same customer, including creation of the first cart.
export async function lockCustomer(db: Prisma.TransactionClient, userId: string) {
  await db.$queryRaw`SELECT user_id FROM \`user\` WHERE user_id = ${userId} FOR UPDATE`;
}

@Injectable()
export class CartService {
  constructor(private readonly db: PrismaService) {}

  catalog() {
    return this.db.product.findMany({
      where: { active: true, shop: { active: true } },
      include: productInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async product(id: string, db: Prisma.TransactionClient = this.db) {
    const product = await db.product.findFirst({
      where: { id, active: true, shop: { active: true } },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Sản phẩm không còn kinh doanh hoặc không tồn tại.');
    return product;
  }

  list(userId: string, db: Prisma.TransactionClient = this.db, itemIds?: string[]) {
    return db.cartItem.findMany({
      where: { cart: { userId }, id: itemIds ? { in: itemIds } : undefined },
      include: { product: { include: productInclude } },
      orderBy: [{ product: { shopId: 'asc' } }, { id: 'asc' }],
    });
  }

  add(userId: string, input: AddCartItemDto) {
    return this.db.$transaction(async (db) => {
      await lockCustomer(db, userId);
      const product = await this.product(input.productId, db);
      const cart = await db.cart.upsert({ where: { userId }, create: { userId }, update: {} });
      const key = { cartId: cart.id, productId: product.id };
      const existing = await db.cartItem.findUnique({ where: { cartId_productId: key } });
      const quantity = input.quantity + (existing?.quantity ?? 0);
      checkStock(product, quantity);
      if (existing) {
        return db.cartItem.update({
          where: { id: existing.id },
          data: { quantity, revision: { increment: 1 } },
        });
      }
      if ((await db.cartItem.count({ where: { cartId: cart.id } })) >= MAX_CART_LINES) {
        throw new BadRequestException(
          `Giỏ hàng chỉ chứa tối đa ${MAX_CART_LINES} mặt hàng khác nhau.`,
        );
      }
      return db.cartItem.create({ data: { ...key, quantity } });
    });
  }

  update(userId: string, id: string, quantity: number) {
    return this.db.$transaction(async (db) => {
      await lockCustomer(db, userId);
      const [item] = await this.list(userId, db, [id]);
      if (!item) throw new NotFoundException('Không tìm thấy mặt hàng trong giỏ.');
      checkStock(item.product, quantity);
      return db.cartItem.update({ where: { id }, data: { quantity, revision: { increment: 1 } } });
    });
  }

  remove(userId: string, id: string) {
    return this.db.$transaction(async (db) => {
      await lockCustomer(db, userId);
      await db.cartItem.deleteMany({ where: { id, cart: { userId } } });
      return { id };
    });
  }
}
