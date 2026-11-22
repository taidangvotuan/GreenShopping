'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import { useCurrentUser } from '../../auth-user';
import { PromotionCodeInput } from '../../promotion/components/promotion-code-input';
import { cartKey } from '../services/cart-api';
import { checkoutApi, quoteKey } from '../services/checkout-api';
import { ordersKey } from '../services/order-api';
import type { CheckoutInput, Discounts, PaymentMethod, QuoteInput, SavedAddress } from '../types';
import { money, panel, PurchaseSteps, Summary } from './checkout-summary';

export function CheckoutForm({
  source,
  initialDiscounts,
}: {
  source: QuoteInput;
  initialDiscounts: Discounts;
}) {
  const { user } = useCurrentUser();
  const [discounts, setDiscounts] = useState(initialDiscounts);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOCK');
  const [ecoShopIds, setEcoShopIds] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [addressVersion, setAddressVersion] = useState(0);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const cache = useQueryClient();
  const router = useRouter();
  const input = { ...source, ...discounts };
  const quote = useQuery({
    queryKey: [...quoteKey, input],
    queryFn: () => checkoutApi.quote(input),
    retry: false,
  });
  const addresses = useQuery({
    queryKey: ['shopping', 'addresses'],
    queryFn: checkoutApi.addresses,
  });
  const savedId = selectedAddress ?? addresses.data?.[0]?.id ?? '';
  const saved = addresses.data?.find((address) => address.id === savedId);
  const order = useMutation({
    mutationFn: (body: CheckoutInput) => checkoutApi.place(body),
    onSuccess: async ({ id }) => {
      router.push(`/checkout/result?order=${id}`);
      await Promise.all([
        cache.invalidateQueries({ queryKey: cartKey }),
        cache.invalidateQueries({ queryKey: ordersKey }),
        cache.invalidateQueries({ queryKey: ['products'] }),
      ]);
    },
    onError: () => {
      void quote.refetch();
    },
  });
  const totals = quote.data;
  const valid =
    !!totals &&
    !quote.isFetching &&
    !quote.isError &&
    !totals.promotionError &&
    !totals.pointsError;
  const back = source.buyNow ? `/products/${source.buyNow.productId}` : '/cart';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || !totals || order.isPending) return;
    const form = new FormData(event.currentTarget);
    const field = (key: string) => String(form.get(key) ?? '').trim();
    const body = {
      ...input,
      paymentMethod,
      expectedTotal: totals.grandTotal,
      ecoShopIds: ecoShopIds.filter((id) => totals.shops.some((shop) => shop.shopId === id)).sort(),
      address: {
        recipientName: field('recipientName'),
        phone: field('phone'),
        province: field('province'),
        ward: field('ward'),
        addressLine: field('addressLine'),
      },
    };
    const payload = JSON.stringify(body);
    if (request.current?.payload !== payload)
      request.current = { payload, id: crypto.randomUUID() };
    order.mutate({ ...body, requestId: request.current.id });
  }

  return (
    <div className="space-y-5">
      <Link href={back} className="text-sm font-semibold text-primary-900">
        ← {source.buyNow ? 'Quay lại sản phẩm' : 'Quay lại giỏ hàng'}
      </Link>
      <header>
        <h1 className="text-3xl font-bold">Thanh toán</h1>
      </header>
      <PurchaseSteps step={1} />
      <ErrorMessage error={quote.error} />
      {quote.isPending && <p role="status">Đang tính tổng tiền…</p>}
      <form
        onSubmit={submit}
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div className="space-y-5">
          <section className={`${panel} space-y-4`}>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShopIcon name="pin" /> Địa chỉ nhận hàng
            </h2>
            {!!addresses.data?.length && (
              <label className="block text-sm">
                Địa chỉ đã lưu
                <select
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2"
                  value={savedId}
                  onChange={(event) => {
                    setSelectedAddress(event.target.value);
                    setAddressVersion((value) => value + 1);
                  }}
                >
                  <option value="">Nhập địa chỉ khác</option>
                  {addresses.data.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.recipientName} · {address.addressLine}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <AddressFields
              key={`${addressVersion}-${savedId}-${user?.userId ?? ''}`}
              saved={saved}
              name={user?.fullName}
              phone={user?.phone ?? undefined}
            />
          </section>
          {totals?.shops.map((shop) => (
            <section key={shop.shopId} className={`${panel} space-y-4`}>
              <h2 className="flex justify-between gap-3 font-semibold">
                <span>{shop.shopName}</span>
                <span>{money(shop.subtotal)}</span>
              </h2>
              {shop.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 border-t border-gray-100 pt-3"
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="size-14 rounded-lg object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">Số lượng {item.quantity}</p>
                  </div>
                  <strong className="text-sm">{money(item.unitPrice * item.quantity)}</strong>
                </div>
              ))}
              <p className="flex justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
                <span className="flex items-center gap-2">
                  <ShopIcon name="truck" /> Giao tiêu chuẩn
                </span>
                <strong>{money(shop.shippingFee)}</strong>
              </p>
              <label className="flex items-center gap-3 rounded-lg bg-primary-50 p-3 text-sm text-primary-900">
                <input
                  type="checkbox"
                  className="size-4 accent-primary-800"
                  checked={ecoShopIds.includes(shop.shopId)}
                  onChange={(event) =>
                    setEcoShopIds(
                      event.target.checked
                        ? [...ecoShopIds, shop.shopId]
                        : ecoShopIds.filter((id) => id !== shop.shopId),
                    )
                  }
                />
                Yêu cầu đóng gói xanh cho cửa hàng này
              </label>
            </section>
          ))}
          <PromotionCodeInput
            discounts={discounts}
            onChange={setDiscounts}
            quote={totals}
            updating={quote.isFetching}
          />
          <fieldset className={`${panel} space-y-3`}>
            <h2 className="text-lg font-semibold" id="payment-heading">
              Phương thức thanh toán
            </h2>
            <div role="radiogroup" aria-labelledby="payment-heading" className="space-y-3">
              {(
                [
                  {
                    value: 'MOCK',
                    title: 'Thanh toán trực tuyến mô phỏng',
                    description: 'Hoàn tất trong 15 phút kể từ khi đặt hàng.',
                  },
                  {
                    value: 'COD',
                    title: 'Thanh toán khi nhận hàng (COD)',
                    description: 'Thanh toán theo từng đơn giao đến.',
                  },
                ] as const
              ).map((method) => (
                <label
                  key={method.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${paymentMethod === method.value ? 'border-primary-600 bg-primary-100' : 'border-gray-200'}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    className="mt-1 accent-primary-800"
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{method.title}</span>
                    <span className="text-xs text-gray-600">{method.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-4">
          <ErrorMessage error={order.error} />
          {totals && (
            <>
              <Summary title="Tóm tắt đơn hàng" totals={totals} code={totals.voucherCode}>
                <Button
                  type="submit"
                  fullWidth
                  className="bg-primary-900"
                  isLoading={order.isPending}
                  disabled={!valid}
                >
                  Đặt hàng · {money(totals.grandTotal)}
                </Button>
              </Summary>
              <section className="space-y-2 rounded-xl bg-primary-100 p-5 text-sm">
                <h2 className="font-semibold">Thanh toán theo cửa hàng</h2>
                {totals.shops.map((shop) => (
                  <p key={shop.shopId} className="flex justify-between gap-2">
                    <span>{shop.shopName}</span>
                    <strong>{money(shop.grandTotal)}</strong>
                  </p>
                ))}
              </section>
            </>
          )}
        </aside>
      </form>
    </div>
  );
}

function AddressFields({
  saved,
  name,
  phone,
}: {
  saved?: SavedAddress;
  name?: string;
  phone?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        required
        name="recipientName"
        label="Người nhận"
        autoComplete="shipping name"
        minLength={2}
        maxLength={150}
        defaultValue={saved?.recipientName ?? name}
      />
      <Input
        required
        name="phone"
        label="Số điện thoại"
        type="tel"
        autoComplete="shipping tel"
        pattern={'0[0-9]{9}|\\+84[0-9]{9}'}
        defaultValue={saved?.phone ?? phone}
      />
      <Input
        required
        name="province"
        label="Tỉnh / Thành phố"
        maxLength={100}
        defaultValue={saved?.province}
      />
      <Input required name="ward" label="Phường / Xã" maxLength={100} defaultValue={saved?.ward} />
      <div className="sm:col-span-2">
        <Input
          required
          name="addressLine"
          label="Số nhà, tên đường"
          autoComplete="shipping street-address"
          minLength={2}
          maxLength={255}
          defaultValue={saved?.addressLine}
        />
      </div>
    </div>
  );
}
