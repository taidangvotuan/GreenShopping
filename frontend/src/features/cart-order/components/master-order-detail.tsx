'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import { orderApi, ordersKey } from '../services/order-api';
import { dateTime, money, panel, primaryLink, Summary } from './checkout-summary';
import {
  orderCode,
  orderLabels,
  paymentLabels,
  ShipmentTimeline,
  shipmentLabels,
  StatusBadge,
} from './order-status-timeline';

export function MasterOrderDetail({ id }: { id: string }) {
  const order = useQuery({
    queryKey: [...ordersKey, id],
    queryFn: () => orderApi.get(id),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !['COMPLETED', 'CANCELLED'].includes(status) ? 15_000 : false;
    },
  });
  if (order.isPending) return <p role="status">Đang tải tiến độ đơn hàng…</p>;
  if (!order.data) return <ErrorMessage error={order.error} />;
  const { data } = order;
  const delivered = data.subOrders.filter((subOrder) => subOrder.status === 'DELIVERED').length;
  const payment = data.payment;
  const waiting = data.status === 'AWAITING_PAYMENT';

  return (
    <div className="space-y-5">
      <Link href="/orders" className="text-sm font-semibold text-primary-900">
        ← Đơn hàng của bạn
      </Link>
      <h1 className="text-3xl font-bold">Theo dõi đơn hàng</h1>
      <ErrorMessage error={order.error} />
      <section className="rounded-xl bg-primary-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary-900">Đơn tổng</p>
            <h2 className="text-2xl font-bold">{orderCode(id)}</h2>
          </div>
          <StatusBadge
            label={orderLabels[data.status]}
            tone={data.status === 'CANCELLED' || data.status === 'DELIVERY_ISSUE' ? 'red' : 'green'}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-700">
          <p>Đặt ngày {dateTime(data.createdAt)}</p>
          <p className="flex items-center gap-2">
            <ShopIcon name="truck" /> {delivered}/{data.subOrders.length} đơn con đã giao
          </p>
          <p>Cập nhật {dateTime(data.updatedAt)}</p>
        </div>
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {data.subOrders.map((subOrder) => (
            <section key={subOrder.id} className={`${panel} space-y-4`}>
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{subOrder.shopName}</h2>
                  <p className="text-sm text-gray-600">{money(subOrder.grandTotal)}</p>
                </div>
                <StatusBadge
                  label={shipmentLabels[subOrder.status]}
                  tone={subOrder.status === 'DELIVERY_FAILED' ? 'red' : 'neutral'}
                />
              </header>
              <ul className="space-y-2 text-sm">
                {subOrder.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="" className="size-10 rounded object-cover" />
                    )}
                    <Link href={`/products/${item.productId}`} className="hover:underline">
                      {item.productName}
                    </Link>
                    <span>× {item.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <ShopIcon name="package" />
                  {subOrder.shipment ? (
                    <span className="break-all">Mã theo dõi {subOrder.shipment.trackingCode}</span>
                  ) : (
                    <span>
                      {subOrder.status === 'CANCELLED' ? 'Đơn con đã hủy' : 'Chưa tạo vận đơn'}
                    </span>
                  )}
                </p>
                {subOrder.ecoPackaging && <p className="text-sm text-primary-900">Đóng gói xanh</p>}
                <ShipmentTimeline history={subOrder.history} />
                {payment.method === 'COD' && subOrder.status !== 'CANCELLED' && (
                  <p className="text-sm text-gray-600">
                    {subOrder.status === 'DELIVERED' ? 'Đã thu COD' : 'Tiền COD khi nhận hàng'} ·{' '}
                    {money(subOrder.grandTotal)}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
        <aside className="space-y-4">
          <Summary title="Chi tiết thanh toán" totals={data} code={data.voucherCode}>
            <p className="mb-3 text-sm text-gray-700">
              {payment.method === 'COD' ? 'Thanh toán khi nhận hàng' : 'Thanh toán online mô phỏng'}{' '}
              · {paymentLabels[payment.status]}
            </p>
            {waiting && (
              <Link className={primaryLink} href={`/checkout/result?order=${id}`}>
                Tiếp tục thanh toán
              </Link>
            )}
          </Summary>
          <section className={`${panel} space-y-2 text-sm`}>
            <h2 className="flex items-center gap-2 font-semibold">
              <ShopIcon name="pin" /> Địa chỉ nhận hàng
            </h2>
            <p>
              {data.recipientName} · {data.phone}
            </p>
            <p>
              {data.addressLine}, {data.ward}, {data.province}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
