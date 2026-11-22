import type { ReactNode } from 'react';
import type { Totals } from '../types';

export const money = (amount: string | number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(amount));

export const dateTime = (time: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(time));

export const panel = 'rounded-xl border border-gray-200 bg-white p-5';
export const primaryLink =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800';
export const secondaryLink =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-primary-900 hover:bg-primary-50';

export function Summary({
  totals,
  title,
  code,
  children,
}: {
  totals: Totals;
  title: string;
  code?: string | null;
  children?: ReactNode;
}) {
  const rows: [string, number | string][] = [
    ['Tiền hàng', totals.subtotal],
    ['Phí giao', totals.shippingFee],
  ];
  if (Number(totals.voucherDiscount))
    rows.push([`Voucher ${code ?? ''}`.trim(), -Number(totals.voucherDiscount)]);
  if (Number(totals.pointDiscount)) rows.push(['Điểm xanh', -Number(totals.pointDiscount)]);
  return (
    <section className={panel} aria-live="polite">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <dl className="space-y-3 border-y border-gray-200 py-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-gray-600">{label}</dt>
            <dd className="tabular-nums">{money(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="py-4">
        <p className="text-sm font-semibold">Tổng thanh toán</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{money(totals.grandTotal)}</p>
      </div>
      {children}
    </section>
  );
}

export function PurchaseSteps({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2 text-sm text-gray-500" aria-label="Tiến trình đặt hàng">
      {['Giỏ hàng', 'Thanh toán', 'Hoàn tất'].map((name, index) => (
        <li
          key={name}
          aria-current={index === step ? 'step' : undefined}
          className={step === index ? 'font-semibold text-primary-900' : ''}
        >
          <span className="mr-1 inline-grid size-5 place-items-center rounded-full border text-xs">
            {index + 1}
          </span>
          {name}
        </li>
      ))}
    </ol>
  );
}
