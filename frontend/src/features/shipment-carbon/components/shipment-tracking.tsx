'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Pagination } from '../../../shared/components/ui/pagination';
import { dateTime, money, panel } from '../../cart-order/components/checkout-summary';
import {
  orderCode,
  ShipmentTimeline,
  shipmentLabels,
  StatusBadge,
} from '../../cart-order/components/order-status-timeline';
import { ordersKey } from '../../cart-order/services/order-api';
import type { ManagedShipment, ShipmentStatus } from '../../cart-order/types';
import { shipmentApi } from '../services/shipment-api';

const transitions: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  PROCESSING: ['READY'],
  READY: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED: ['IN_TRANSIT'],
};
const filters: ShipmentStatus[] = [
  'PROCESSING',
  'READY',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
];

export function ShipmentManagement() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ShipmentStatus | ''>('');
  const query = useQuery({
    queryKey: ['manage-shipments', page, filter],
    queryFn: () => shipmentApi.manage(page, filter),
  });
  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <h1 className="text-3xl font-bold">Quản lý tiến độ giao hàng</h1>
      <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
        Vận chuyển mô phỏng. Các mốc và ghi chú bạn cập nhật xuất hiện trong lịch sử theo dõi của
        người mua.
      </p>
      <label className="flex flex-wrap items-center gap-3 text-sm font-medium">
        Trạng thái
        <select
          className="rounded-lg border border-gray-300 bg-white p-2"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as ShipmentStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {filters.map((status) => (
            <option key={status} value={status}>
              {shipmentLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage error={query.error} />
      {query.isPending && <p role="status">Đang tải tiến độ giao hàng…</p>}
      {query.data?.items.length === 0 && <p>Chưa có đơn con cần theo dõi ở trang này.</p>}
      {query.data?.items.map((shipment) => (
        <ShipmentRow key={shipment.id} shipment={shipment} />
      ))}
      {query.data && (
        <Pagination
          page={page}
          pageSize={query.data.pageSize}
          total={query.data.total}
          onChange={setPage}
        />
      )}
    </section>
  );
}

function ShipmentRow({ shipment }: { shipment: ManagedShipment }) {
  const cache = useQueryClient();
  const update = useMutation({
    mutationFn: ({ status, note }: { status: ShipmentStatus; note: string }) =>
      shipmentApi.update(shipment.id, shipment.status, status, note),
    onSuccess: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ['manage-shipments'] }),
        cache.invalidateQueries({ queryKey: ordersKey }),
        cache.invalidateQueries({ queryKey: ['manage-payments'] }),
      ]),
  });
  const possible = transitions[shipment.status] ?? [];
  const { masterOrder } = shipment;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const status = fields.get('status') as ShipmentStatus;
    if (possible.includes(status))
      update.mutate({ status, note: String(fields.get('note') ?? '') });
  }

  return (
    <details className={panel}>
      <summary className="cursor-pointer">
        <span className="ml-2 inline-flex flex-wrap items-center gap-3">
          <strong>
            {shipment.shopName} · {orderCode(masterOrder.id)}
          </strong>
          <StatusBadge
            label={shipmentLabels[shipment.status]}
            tone={
              shipment.status === 'DELIVERY_FAILED'
                ? 'red'
                : shipment.status === 'DELIVERED'
                  ? 'green'
                  : 'neutral'
            }
          />
          <span className="text-sm text-gray-600">{dateTime(shipment.updatedAt)}</span>
        </span>
      </summary>
      <div className="mt-4 grid gap-5 border-t border-gray-100 pt-4 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <p>
            {shipment.shipment
              ? `Mã theo dõi ${shipment.shipment.trackingCode}`
              : 'Chưa tạo vận đơn'}
          </p>
          <p>
            Người nhận {masterOrder.recipientName} · {masterOrder.phone}
          </p>
          <p>
            {masterOrder.addressLine}, {masterOrder.ward}, {masterOrder.province}
          </p>
          <p>{shipment.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}</p>
          {shipment.ecoPackaging && <p className="text-primary-900">Yêu cầu đóng gói xanh</p>}
          {masterOrder.payment.method === 'COD' && (
            <p>
              {shipment.status === 'DELIVERED' ? 'Đã thu COD' : 'Tiền COD cần thu'} ·{' '}
              {money(shipment.grandTotal)}
            </p>
          )}
          <ShipmentTimeline history={shipment.history} />
        </div>
        {possible.length > 0 && (
          <form key={shipment.status} className="space-y-3" onSubmit={submit}>
            <label className="block text-sm font-medium">
              Mốc giao hàng mới
              <select
                name="status"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2"
              >
                {possible.map((status) => (
                  <option key={status} value={status}>
                    {shipmentLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Ghi chú cho người mua" name="note" maxLength={500} />
            <Button className="bg-primary-900" type="submit" isLoading={update.isPending}>
              {shipment.status === 'PROCESSING'
                ? 'Sẵn sàng giao và tạo vận đơn'
                : 'Cập nhật trạng thái'}
            </Button>
            <ErrorMessage error={update.error} />
          </form>
        )}
      </div>
    </details>
  );
}
