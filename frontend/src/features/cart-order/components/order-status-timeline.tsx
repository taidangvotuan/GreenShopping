import type { OrderStatus, PaymentStatus, ShipmentEvent, ShipmentStatus } from '../types';
import { dateTime } from './checkout-summary';

export const paymentLabels: Record<PaymentStatus, string> = {
  PENDING: 'Chờ thanh toán',
  SUCCEEDED: 'Thành công',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
};
export const orderLabels: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao',
  DELIVERY_ISSUE: 'Có đơn giao thất bại',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};
export const shipmentLabels: Record<ShipmentStatus, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PROCESSING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng giao',
  IN_TRANSIT: 'Đang vận chuyển',
  OUT_FOR_DELIVERY: 'Đang giao đến bạn',
  DELIVERED: 'Đã giao',
  DELIVERY_FAILED: 'Giao thất bại',
  CANCELLED: 'Đã hủy',
};

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
}) {
  const style = {
    neutral: 'bg-gray-100 text-gray-800',
    green: 'bg-primary-100 text-primary-900',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-900',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style[tone]}`}>
      {label}
    </span>
  );
}

export function ShipmentTimeline({ history }: { history: ShipmentEvent[] }) {
  return (
    <ol className="ms-2 space-y-4 border-s border-gray-200 ps-4">
      {[...history].reverse().map((event, index) => (
        <li key={event.id} className="relative flex flex-wrap justify-between gap-x-3 text-sm">
          <span
            aria-hidden
            className={`absolute -start-[21px] top-1.5 size-2.5 rounded-full border-2 border-primary-700 ${index ? 'bg-white' : 'bg-primary-700'}`}
          />
          <div>
            <p className="font-medium">{shipmentLabels[event.status]}</p>
            {event.note && <p className="text-gray-600">{event.note}</p>}
          </div>
          <time className="text-xs text-gray-600" dateTime={event.createdAt}>
            {dateTime(event.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

export const orderCode = (id: string) => `GS-${id.slice(0, 8).toUpperCase()}`;
