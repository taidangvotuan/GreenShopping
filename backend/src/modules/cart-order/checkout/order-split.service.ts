export type PricedShop = {
  shopId: string;
  shopName: string;
  subtotal: number;
  shippingFee: number;
};

export function splitDiscounts<T extends PricedShop>(
  shops: T[],
  subtotal: number,
  voucherDiscount: number,
  pointDiscount: number,
) {
  const proportional = (discount: number, part: number, total: number) =>
    total === 0 ? 0 : Number((BigInt(discount) * BigInt(part)) / BigInt(total));

  let runningSubtotal = 0;
  let runningVoucher = 0;
  let runningPoints = 0;
  return shops.map((shop) => {
    runningSubtotal += shop.subtotal;
    const voucher = proportional(voucherDiscount, runningSubtotal, subtotal);
    const points = proportional(
      pointDiscount,
      runningSubtotal - voucher,
      subtotal - voucherDiscount,
    );
    const shopVoucher = voucher - runningVoucher;
    const shopPoints = points - runningPoints;
    runningVoucher = voucher;
    runningPoints = points;
    return {
      ...shop,
      voucherDiscount: shopVoucher,
      pointDiscount: shopPoints,
      grandTotal: shop.subtotal + shop.shippingFee - shopVoucher - shopPoints,
    };
  });
}
