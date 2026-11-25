import { splitDiscounts } from '../../src/modules/cart-order/checkout/order-split.service';

const shop = (shopId: string, subtotal: number, shippingFee: number) => ({
  shopId,
  shopName: `Shop ${shopId}`,
  subtotal,
  shippingFee,
});

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('splitDiscounts — chia voucher & điểm theo từng shop', () => {
  it('khớp kịch bản checkout 2 shop: tổng đơn con bằng tổng đơn tổng, không thất thoát tiền', () => {
    const shops = [shop('A', 499_999, 20_000), shop('B', 1, 10_000)];

    const result = splitDiscounts(shops, 500_000, 50_000, 1_500);

    expect(result.map(({ voucherDiscount, pointDiscount, grandTotal }) => ({
      voucherDiscount,
      pointDiscount,
      grandTotal,
    }))).toEqual([
      { voucherDiscount: 49_999, pointDiscount: 1_500, grandTotal: 468_500 },
      { voucherDiscount: 1, pointDiscount: 0, grandTotal: 10_000 },
    ]);
    expect(sum(result.map((s) => s.grandTotal))).toBe(500_000 + 30_000 - 50_000 - 1_500);
  });

  it('phần dư do làm tròn dồn cho shop sau, tổng giảm giá luôn đúng bằng giá trị gốc', () => {
    const shops = [shop('A', 100, 0), shop('B', 100, 0), shop('C', 100, 0)];

    const result = splitDiscounts(shops, 300, 100, 50);

    expect(result.map((s) => s.voucherDiscount)).toEqual([33, 33, 34]);
    expect(sum(result.map((s) => s.voucherDiscount))).toBe(100);
    expect(sum(result.map((s) => s.pointDiscount))).toBe(50);
    expect(result.every((s) => s.grandTotal >= 0)).toBe(true);
  });

  it('không có giảm giá → giữ nguyên tiền hàng + phí giao', () => {
    const result = splitDiscounts([shop('A', 120_000, 25_000)], 120_000, 0, 0);

    expect(result[0]).toMatchObject({ voucherDiscount: 0, pointDiscount: 0, grandTotal: 145_000 });
  });

  it('tiền hàng bằng 0 → không chia cho 0, giảm giá bằng 0', () => {
    const result = splitDiscounts([shop('A', 0, 10_000)], 0, 0, 0);

    expect(result[0]).toMatchObject({ voucherDiscount: 0, pointDiscount: 0, grandTotal: 10_000 });
  });

  it('giữ nguyên các trường khác của shop (id, tên, phí giao)', () => {
    const [result] = splitDiscounts([shop('A', 1_000, 500)], 1_000, 100, 0);

    expect(result).toMatchObject({ shopId: 'A', shopName: 'Shop A', shippingFee: 500 });
  });
});
