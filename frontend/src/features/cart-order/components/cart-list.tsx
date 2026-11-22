'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import { PromotionCodeInput } from '../../promotion/components/promotion-code-input';
import { cartApi, cartKey } from '../services/cart-api';
import { checkoutApi, quoteKey } from '../services/checkout-api';
import type { CartItem, Discounts } from '../types';
import { CartItemRow } from './cart-item';
import { money, panel, primaryLink, PurchaseSteps, Summary } from './checkout-summary';

export function CartList() {
  const cache = useQueryClient();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [discounts, setDiscounts] = useState<Discounts>({});
  const cart = useQuery({ queryKey: cartKey, queryFn: cartApi.list });
  const items = cart.data ?? [];
  const selected = items.filter(
    ({ id, quantity, product }) =>
      !excluded.includes(id) && product.active && product.shop.active && quantity <= product.stock,
  );
  const cartItemIds = selected.map((item) => item.id);
  const selectedIds = new Set(cartItemIds);
  const quote = useQuery({
    queryKey: [
      ...quoteKey,
      selected.map((item) => [
        item.id,
        item.revision,
        item.product.price,
        item.product.shop.shippingFee,
      ]),
      discounts,
    ],
    queryFn: () => checkoutApi.quote({ cartItemIds, ...discounts }),
    enabled: cartItemIds.length > 0,
    retry: false,
  });
  const change = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity?: number }) =>
      quantity ? cartApi.update(id, quantity) : cartApi.remove(id),
    onSettled: () => cache.invalidateQueries({ queryKey: cartKey }),
  });
  const checkoutParams = new URLSearchParams();
  for (const id of cartItemIds) checkoutParams.append('item', id);
  if (discounts.voucherCode) checkoutParams.set('voucher', discounts.voucherCode);
  if (discounts.points) checkoutParams.set('points', String(discounts.points));
  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const id = item.product.shop.id;
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  }
  const totals = quote.data;
  const canCheckout =
    totals &&
    !quote.isFetching &&
    !quote.isError &&
    !change.isPending &&
    !totals.promotionError &&
    !totals.pointsError;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-gray-600">
          <Link href="/">Trang chủ</Link> / Giỏ hàng
        </p>
        <h1 className="mt-2 text-3xl font-bold">Giỏ hàng của bạn</h1>
      </header>
      <PurchaseSteps step={0} />
      {cart.isPending && <p role="status">Đang tải giỏ hàng…</p>}
      <ErrorMessage error={cart.error ?? change.error} />
      {cart.data?.length === 0 && (
        <div className={`${panel} space-y-3`}>
          <p>Giỏ hàng của bạn đang trống.</p>
          <Link href="/products" className={primaryLink}>
            Khám phá sản phẩm
          </Link>
        </div>
      )}
      {items.length > 0 && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            {[...groups].map(([shopId, group]) => (
              <section key={shopId} className={panel}>
                <h2 className="font-semibold">
                  {group[0].product.shop.name} ·{' '}
                  {group.reduce((sum, item) => sum + item.quantity, 0)} món
                </h2>
                <p className="mb-3 mt-1 text-sm text-gray-600">
                  Phí giao theo cửa hàng {money(group[0].product.shop.shippingFee)}
                </p>
                {group.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    disabled={change.isPending}
                    onSelect={() =>
                      setExcluded((ids) =>
                        ids.includes(item.id)
                          ? ids.filter((id) => id !== item.id)
                          : [...ids, item.id],
                      )
                    }
                    onQuantity={(quantity) => change.mutate({ id: item.id, quantity })}
                    onRemove={() => change.mutate({ id: item.id })}
                  />
                ))}
              </section>
            ))}
            <PromotionCodeInput
              discounts={discounts}
              onChange={setDiscounts}
              quote={totals}
              updating={quote.isFetching}
            />
            <Link href="/products" className="text-sm font-medium text-primary-900">
              ← Tiếp tục mua sắm
            </Link>
          </div>
          <aside className="space-y-4">
            <ErrorMessage error={quote.error} />
            {totals ? (
              <>
                <Summary totals={totals} title="Tóm tắt giỏ hàng" code={totals.voucherCode}>
                  {canCheckout ? (
                    <Link className={`${primaryLink} w-full`} href={`/checkout?${checkoutParams}`}>
                      Tiến hành thanh toán
                    </Link>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {quote.isFetching || change.isPending
                        ? 'Đang cập nhật giỏ hàng…'
                        : 'Kiểm tra lại ưu đãi và sản phẩm đã chọn để tiếp tục.'}
                    </p>
                  )}
                </Summary>
                <section className="space-y-2 rounded-xl bg-primary-100 p-5 text-sm">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <ShopIcon name="shield" /> Tổng tiền theo cửa hàng
                  </h2>
                  {totals.shops.map((shop) => (
                    <p key={shop.shopId} className="flex justify-between gap-2">
                      <span>{shop.shopName}</span>
                      <strong>{money(shop.grandTotal)}</strong>
                    </p>
                  ))}
                </section>
              </>
            ) : (
              !quote.isError && (
                <p className={panel} role="status">
                  {selected.length
                    ? 'Đang tính tổng tiền…'
                    : 'Chọn sản phẩm còn hàng để thanh toán.'}
                </p>
              )
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
