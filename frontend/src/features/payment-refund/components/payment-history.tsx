'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Pagination } from '../../../shared/components/ui/pagination';
import { dateTime, money } from '../../cart-order/components/checkout-summary';
import {
  orderCode,
  paymentLabels,
  StatusBadge,
} from '../../cart-order/components/order-status-timeline';
import type { PaymentStatus } from '../../cart-order/types';
import { paymentApi } from '../services/payment-api';

export function PaymentManagement() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const query = useQuery({
    queryKey: ['manage-payments', page, status],
    queryFn: () => paymentApi.manage(page, status),
    refetchInterval: 30_000,
  });
  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <h1 className="text-3xl font-bold">Quản lý thanh toán</h1>
      <label className="flex flex-wrap items-center gap-3 text-sm font-medium">
        Trạng thái
        <select
          className="rounded-lg border border-gray-300 bg-white p-2"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as PaymentStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tất cả giao dịch</option>
          {Object.entries(paymentLabels).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {query.isPending && <p role="status">Đang tải giao dịch…</p>}
      <ErrorMessage error={query.error} />
      {query.data?.items.length === 0 && <p>Chưa có giao dịch phù hợp.</p>}
      {!!query.data?.items.length && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[45rem] text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                {['Đơn hàng', 'Phương thức', 'Số tiền', 'Trạng thái', 'Lịch sử'].map((title) => (
                  <th key={title} className="p-3" scope="col">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((payment) => (
                <tr key={payment.id} className="border-t border-gray-100 align-top">
                  <td className="p-3">
                    <strong>{orderCode(payment.masterOrder.id)}</strong>
                    <p>{payment.masterOrder.recipientName}</p>
                    <p className="text-xs text-gray-600">{dateTime(payment.createdAt)}</p>
                  </td>
                  <td className="p-3">{payment.method === 'COD' ? 'COD' : 'Online mô phỏng'}</td>
                  <td className="p-3 font-medium">{money(payment.amount)}</td>
                  <td className="p-3">
                    <StatusBadge
                      label={paymentLabels[payment.status]}
                      tone={
                        payment.status === 'SUCCEEDED'
                          ? 'green'
                          : payment.status === 'PENDING'
                            ? 'amber'
                            : 'red'
                      }
                    />
                  </td>
                  <td className="p-3">
                    <details>
                      <summary className="cursor-pointer text-primary-900">Xem các mốc</summary>
                      <ul className="mt-2 space-y-2 text-xs">
                        {payment.events.map((event) => (
                          <li key={event.id}>
                            {paymentLabels[event.status]} · {dateTime(event.createdAt)}
                          </li>
                        ))}
                      </ul>
                      {payment.expiresAt && (
                        <p className="mt-2 text-xs">Hạn thanh toán {dateTime(payment.expiresAt)}</p>
                      )}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && (
        <Pagination
          page={page}
          total={query.data.total}
          pageSize={query.data.pageSize}
          onChange={setPage}
        />
      )}
    </section>
  );
}
