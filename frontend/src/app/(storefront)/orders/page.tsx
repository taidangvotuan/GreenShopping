'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  dateTime,
  money,
  panel,
  secondaryLink,
} from '../../../features/cart-order/components/checkout-summary';
import {
  orderCode,
  orderLabels,
  paymentLabels,
  StatusBadge,
} from '../../../features/cart-order/components/order-status-timeline';
import { orderApi, ordersKey } from '../../../features/cart-order/services/order-api';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Pagination } from '../../../shared/components/ui/pagination';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const orders = useQuery({
    queryKey: [...ordersKey, 'list', page],
    queryFn: () => orderApi.list(page),
  });
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Đơn hàng của bạn</h1>
      {orders.isPending && <p role="status">Đang tải đơn hàng…</p>}
      <ErrorMessage error={orders.error} />
      {orders.data?.total === 0 && (
        <p>
          Chưa có đơn hàng.{' '}
          <Link href="/products" className="text-primary-800 underline">
            Khám phá sản phẩm
          </Link>
        </p>
      )}
      {orders.data?.items.map((order) => (
        <article key={order.id} className={`${panel} space-y-3`}>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">{orderCode(order.id)}</h2>
              <p className="text-sm text-gray-600">{dateTime(order.createdAt)}</p>
            </div>
            <StatusBadge
              label={orderLabels[order.status]}
              tone={
                order.status === 'COMPLETED'
                  ? 'green'
                  : order.status === 'CANCELLED'
                    ? 'red'
                    : 'neutral'
              }
            />
          </header>
          <ul className="space-y-1 border-y border-gray-100 py-3 text-sm">
            {order.subOrders.map((shop) => (
              <li key={shop.id}>
                <strong>{shop.shopName}</strong> ·{' '}
                {shop.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {paymentLabels[order.payment.status]} · <strong>{money(order.grandTotal)}</strong>
            </p>
            <Link href={`/orders/${order.id}`} className={secondaryLink}>
              Xem chi tiết
            </Link>
          </div>
        </article>
      ))}
      {orders.data && (
        <Pagination
          page={page}
          total={orders.data.total}
          pageSize={orders.data.pageSize}
          onChange={setPage}
        />
      )}
    </section>
  );
}
