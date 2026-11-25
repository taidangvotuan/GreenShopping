import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CartService,
  checkStock,
  type CatalogProduct,
} from '../../src/modules/cart-order/cart/cart.service';
import { MAX_CART_LINES } from '../../src/modules/cart-order/checkout/dto/checkout.dto';
import type { PrismaService } from '../../src/prisma/prisma.service';

const USER_ID = '7d4f6f0e-2a59-4a8e-9a43-0b6f3f6b1c11';
const PRODUCT_ID = '1f6cf027-8a54-498a-89e9-f0fdc6e4b236';

function product(overrides: Partial<CatalogProduct> = {}, shopActive = true): CatalogProduct {
  return {
    id: PRODUCT_ID,
    shopId: 'shop-1',
    name: 'Bình giữ nhiệt inox 500ml',
    stock: 10,
    active: true,
    shop: { id: 'shop-1', name: 'Mộc Living', shippingFee: 30_000, active: shopActive },
    ...overrides,
  } as unknown as CatalogProduct;
}

function setup() {
  const tx = {
    $queryRaw: jest.fn(),
    product: { findFirst: jest.fn().mockResolvedValue(product()) },
    cart: { upsert: jest.fn().mockResolvedValue({ id: 'cart-1', userId: USER_ID }) },
    cartItem: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      update: jest.fn((args: unknown) => Promise.resolve(args)),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((args: unknown) => Promise.resolve(args)),
    },
  };
  const db = { $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
  const service = new CartService(db as unknown as PrismaService);
  return { service, tx };
}

describe('checkStock', () => {
  it('cho phép khi còn hàng và không vượt 99', () => {
    expect(() => checkStock(product(), 10)).not.toThrow();
  });

  it.each([
    ['sản phẩm ngừng bán', product({ active: false }), 1],
    ['cửa hàng ngừng hoạt động', product({}, false), 1],
    ['vượt tồn kho', product({ stock: 2 }), 3],
    ['vượt 99 sản phẩm cùng loại', product({ stock: 500 }), 100],
  ])('từ chối 400: %s', (_label, item, quantity) => {
    expect(() => checkStock(item, quantity)).toThrow(BadRequestException);
  });
});

describe('CartService.add', () => {
  it('khóa theo khách trước khi đọc/ghi giỏ, tạo dòng mới khi chưa có sản phẩm', async () => {
    const { service, tx } = setup();

    await service.add(USER_ID, { productId: PRODUCT_ID, quantity: 2 });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.product.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: 'cart-1', productId: PRODUCT_ID, quantity: 2 },
    });
  });

  it('gộp số lượng vào dòng đã có và tăng revision', async () => {
    const { service, tx } = setup();
    tx.cartItem.findUnique.mockResolvedValue({ id: 'item-1', quantity: 3, revision: 4 });

    await service.add(USER_ID, { productId: PRODUCT_ID, quantity: 2 });

    expect(tx.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 5, revision: { increment: 1 } },
    });
    expect(tx.cartItem.create).not.toHaveBeenCalled();
  });

  it('tổng số lượng sau khi gộp vượt tồn kho → 400', async () => {
    const { service, tx } = setup();
    tx.cartItem.findUnique.mockResolvedValue({ id: 'item-1', quantity: 9, revision: 1 });

    await expect(service.add(USER_ID, { productId: PRODUCT_ID, quantity: 2 })).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.cartItem.update).not.toHaveBeenCalled();
  });

  it(`giỏ đã đủ ${MAX_CART_LINES} mặt hàng khác nhau → 400`, async () => {
    const { service, tx } = setup();
    tx.cartItem.count.mockResolvedValue(MAX_CART_LINES);

    await expect(service.add(USER_ID, { productId: PRODUCT_ID, quantity: 1 })).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.cartItem.create).not.toHaveBeenCalled();
  });

  it('sản phẩm không còn kinh doanh → 404', async () => {
    const { service, tx } = setup();
    tx.product.findFirst.mockResolvedValue(null);

    await expect(service.add(USER_ID, { productId: PRODUCT_ID, quantity: 1 })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('CartService.update', () => {
  it('chỉ sửa dòng thuộc giỏ của chính khách; không có → 404', async () => {
    const { service, tx } = setup();
    tx.cartItem.findMany.mockResolvedValue([]);

    await expect(service.update(USER_ID, 'item-x', 1)).rejects.toThrow(NotFoundException);
    expect(tx.cartItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cart: { userId: USER_ID }, id: { in: ['item-x'] } } }),
    );
  });
});
