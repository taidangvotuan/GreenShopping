'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Button } from '../../../shared/components/ui/button';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import {
  dateTime,
  money,
  panel,
  primaryLink,
  PurchaseSteps,
  secondaryLink,
  Summary,
} from '../../cart-order/components/checkout-summary';
import {
  orderCode,
  paymentLabels,
  StatusBadge,
} from '../../cart-order/components/order-status-timeline';
import { cartKey } from '../../cart-order/services/cart-api';
import { quoteKey } from '../../cart-order/services/checkout-api';
import { orderApi, ordersKey } from '../../cart-order/services/order-api';
import type { MasterOrder, MockOutcome } from '../../cart-order/types';
import { paymentApi } from '../services/payment-api';

export function PaymentResult({ id }: { id: string }) {
  const cache = useQueryClient();
  const key = [...ordersKey, id];
  const order = useQuery({
    queryKey: key,
    queryFn: () => orderApi.get(id),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'AWAITING_PAYMENT' ? 10_000 : false),
  });
  const resolve = useMutation({
    mutationFn: (outcome: MockOutcome) => paymentApi.resolve(id, outcome),
    onSuccess: async (payment) => {
      cache.setQueryData<MasterOrder>(
        key,
        (previous) =>
          previous && {
            ...previous,
            payment,
            status: payment.status === 'SUCCEEDED' ? 'PROCESSING' : 'CANCELLED',
          },
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ordersKey }),
        cache.invalidateQueries({ queryKey: cartKey }),
        cache.invalidateQueries({ queryKey: quoteKey }),
        cache.invalidateQueries({ queryKey: ['products'] }),
      ]);
    },
  });

  if (order.isPending) return <p role="status">Đang kiểm tra thanh toán…</p>;
  if (!order.data) return <ErrorMessage error={order.error} />;

  const { data } = order;
  const payment = data.payment;
  const awaiting = data.status === 'AWAITING_PAYMENT' && payment.status === 'PENDING';
  const cod = payment.method === 'COD';
  const completed = payment.status === 'SUCCEEDED' || (cod && payment.status === 'PENDING');
  const items = data.subOrders.flatMap((shop) => shop.items);
  const retry = new URLSearchParams();
  for (const item of items) {
    if (item.sourceCartItemId) retry.append('item', item.sourceCartItemId);
  }
  if (!retry.has('item') && items.length === 1) {
    retry.set('product', items[0].productId);
    retry.set('quantity', String(items[0].quantity));
  }
  if (data.voucherCode) retry.set('voucher', data.voucherCode);
  if (data.pointsUsed) retry.set('points', String(data.pointsUsed));
  const retryHref = retry.has('item') || retry.has('product') ? `/checkout?${retry}` : '/cart';

  return (
    <div className="space-y-5">
      <PurchaseSteps step={awaiting ? 1 : 2} />
      <ErrorMessage error={order.error ?? resolve.error} />
      {awaiting && payment.expiresAt ? (
        <>
          <header className="flex flex-wrap items-center gap-3">
            <ShopIcon name="shield" />
            <h1 className="text-3xl font-bold">Cổng thanh toán mô phỏng</h1>
          </header>
          <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
            Giao dịch thử nghiệm. Chọn một kết quả để kiểm tra luồng thanh toán.
          </p>
          <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
            <PaymentActions
              key={order.dataUpdatedAt}
              seconds={Math.max(
                0,
                Math.ceil((Date.parse(payment.expiresAt) - Date.parse(data.serverTime)) / 1000),
              )}
              expiresAt={payment.expiresAt}
              serverTime={data.serverTime}
              syncing={resolve.isPending || order.isFetching}
              onChoose={resolve.mutate}
              onExpire={() => {
                void order.refetch();
              }}
            />
            <Summary title={`Giao dịch ${orderCode(id)}`} totals={data} code={data.voucherCode}>
              <p className="text-sm text-gray-600">{data.recipientName}</p>
            </Summary>
          </div>
        </>
      ) : (
        <div className={`${panel} mx-auto max-w-2xl space-y-4 text-center`}>
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary-100">
            <ShopIcon name={completed ? 'package' : 'alert'} />
          </div>
          <StatusBadge
            label={
              cod && completed && payment.status === 'PENDING'
                ? 'Thu tiền khi nhận hàng'
                : paymentLabels[payment.status]
            }
            tone={completed ? 'green' : 'red'}
          />
          <h1 className="text-3xl font-bold">
            {completed
              ? cod
                ? 'Đặt hàng thành công'
                : 'Thanh toán thành công'
              : payment.status === 'EXPIRED'
                ? 'Đã hết thời gian thanh toán'
                : payment.status === 'CANCELLED'
                  ? 'Bạn đã hủy thanh toán'
                  : 'Thanh toán thất bại'}
          </h1>
          <p className="text-sm text-gray-600">
            {orderCode(data.id)} · {money(data.grandTotal)}
          </p>
          {!completed && (
            <p className="text-gray-600">
              Đơn đã được hủy.{data.pointsUsed > 0 && ' Điểm xanh đã dùng được hoàn về số dư.'}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/orders/${id}`} className={completed ? primaryLink : secondaryLink}>
              {completed ? 'Theo dõi đơn hàng' : 'Xem chi tiết đơn'}
            </Link>
            <Link
              href={completed ? '/products' : retryHref}
              className={completed ? secondaryLink : primaryLink}
            >
              {completed ? 'Tiếp tục mua sắm' : 'Đặt lại đơn'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentActions({
  seconds,
  expiresAt,
  serverTime,
  syncing,
  onChoose,
  onExpire,
}: {
  seconds: number;
  expiresAt: string;
  serverTime: string;
  syncing: boolean;
  onChoose: (outcome: MockOutcome) => void;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const deadline =
      performance.now() + Math.max(0, Date.parse(expiresAt) - Date.parse(serverTime));
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [expiresAt, serverTime]);

  useEffect(() => {
    if (!remaining && !syncing) {
      const timer = window.setTimeout(onExpire, 1_000);
      return () => window.clearTimeout(timer);
    }
  }, [remaining, syncing, onExpire]);

  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return (
    <section className={`${panel} space-y-4`}>
      <header>
        <h2 className="font-semibold">Thời gian còn lại</h2>
        <p className="mt-2 text-4xl font-bold tabular-nums text-primary-900" role="timer">
          {clock}
        </p>
        <p className="mt-1 text-sm text-gray-600">Hạn thanh toán {dateTime(expiresAt)}</p>
      </header>
      {remaining === 0 && (
        <p role="status" className="text-sm text-red-700">
          Đã hết thời gian. Đang kiểm tra kết quả từ hệ thống…
        </p>
      )}
      <Button
        fullWidth
        className="bg-primary-900"
        disabled={syncing || !remaining}
        onClick={() => onChoose('SUCCEEDED')}
      >
        Mô phỏng thanh toán thành công
      </Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          disabled={syncing || !remaining}
          onClick={() => onChoose('FAILED')}
        >
          Mô phỏng thất bại
        </Button>
        <Button
          variant="outline"
          disabled={syncing || !remaining}
          onClick={() => onChoose('CANCELLED')}
        >
          Hủy thanh toán
        </Button>
      </div>
    </section>
  );
}
