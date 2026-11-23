import { Check, X } from 'lucide-react';
import type {
  MasterOrder,
  OrderStatus,
  PaymentStatus,
  ShipmentEvent,
  ShipmentStatus,
} from '../types';
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

/** Màu badge theo Figma "01 – Design System": Pending · Processing · Shipped · Delivered · Cancelled. */
export type BadgeTone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'purple';

export const orderTone: Record<OrderStatus, BadgeTone> = {
  AWAITING_PAYMENT: 'amber',
  PROCESSING: 'blue',
  SHIPPING: 'purple',
  DELIVERY_ISSUE: 'red',
  COMPLETED: 'green',
  CANCELLED: 'red',
};
export const shipmentTone: Record<ShipmentStatus, BadgeTone> = {
  AWAITING_PAYMENT: 'amber',
  PROCESSING: 'blue',
  READY: 'blue',
  IN_TRANSIT: 'purple',
  OUT_FOR_DELIVERY: 'purple',
  DELIVERED: 'green',
  DELIVERY_FAILED: 'red',
  CANCELLED: 'red',
};
export const paymentTone: Record<PaymentStatus, BadgeTone> = {
  PENDING: 'amber',
  SUCCEEDED: 'green',
  FAILED: 'red',
  EXPIRED: 'red',
  CANCELLED: 'red',
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const style: Record<BadgeTone, string> = {
    neutral: 'bg-gray-100 text-gray-800',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-orange-100 text-orange-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
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
            className={`absolute -start-[21px] top-1.5 size-2.5 rounded-full border-2 ${
              event.status === 'CANCELLED' || event.status === 'DELIVERY_FAILED'
                ? 'border-red-600'
                : 'border-primary-900'
            } ${index ? 'bg-white' : event.status === 'CANCELLED' ? 'bg-red-600' : 'bg-primary-900'}`}
          />
          <div>
            <p className={index ? 'text-gray-700' : 'font-semibold'}>
              {shipmentLabels[event.status]}
            </p>
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

type StepState = 'done' | 'current' | 'failed' | 'upcoming';
interface Step {
  title: string;
  detail: string;
  state: StepState;
}

const SHIPPED: ShipmentStatus[] = ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/**
 * 4 mốc tiến độ của đơn tổng (Figma Screens/OrderDetail):
 * Đã đặt hàng → Đã thanh toán → Đang giao từng đơn con → Hoàn tất toàn bộ.
 * Đồng bộ với trạng thái thanh toán: online PENDING/FAILED/EXPIRED/CANCELLED → không có mốc giao hàng.
 */
export function buildOrderSteps(
  order: Pick<MasterOrder, 'status' | 'createdAt' | 'payment' | 'subOrders'>,
): Step[] {
  const { payment, status } = order;
  const total = order.subOrders.length;
  const delivered = order.subOrders.filter((s) => s.status === 'DELIVERED').length;
  const shipped = order.subOrders.filter((s) => SHIPPED.includes(s.status)).length;
  const cancelled = status === 'CANCELLED';
  const paymentFailed = ['FAILED', 'EXPIRED', 'CANCELLED'].includes(payment.status);

  const paymentStep: Step =
    payment.method === 'COD'
      ? {
          title: 'Thanh toán khi nhận hàng',
          detail:
            payment.status === 'SUCCEEDED'
              ? `Đã thu ${payment.resolvedAt ? dateTime(payment.resolvedAt) : ''}`.trim()
              : cancelled
                ? 'Đơn đã hủy'
                : 'Thu tiền khi giao',
          state: payment.status === 'SUCCEEDED' ? 'done' : cancelled ? 'failed' : 'upcoming',
        }
      : payment.status === 'SUCCEEDED'
        ? {
            title: 'Đã thanh toán',
            detail: payment.resolvedAt ? dateTime(payment.resolvedAt) : '',
            state: 'done',
          }
        : paymentFailed
          ? {
              title:
                payment.status === 'EXPIRED' ? 'Hết hạn thanh toán' : 'Thanh toán không thành công',
              detail: 'Đơn đã hủy, không giao hàng',
              state: 'failed',
            }
          : {
              title: 'Chờ thanh toán',
              detail: payment.expiresAt ? `Hạn ${dateTime(payment.expiresAt)}` : '',
              state: 'current',
            };

  const blocked = cancelled || paymentFailed;
  return [
    { title: 'Đã đặt hàng', detail: dateTime(order.createdAt), state: 'done' },
    paymentStep,
    {
      title: blocked ? 'Không giao hàng' : 'Đang giao từng đơn con',
      detail: blocked ? 'Đơn đã hủy' : `${delivered} / ${total} đơn con đã giao`,
      state: blocked
        ? 'failed'
        : delivered === total && total > 0
          ? 'done'
          : shipped > 0 || status === 'DELIVERY_ISSUE'
            ? 'current'
            : 'upcoming',
    },
    {
      title: 'Hoàn tất toàn bộ',
      detail: blocked
        ? '—'
        : status === 'COMPLETED'
          ? 'Tất cả đơn con đã giao'
          : `Chờ ${total} đơn con giao xong`,
      state: blocked ? 'failed' : status === 'COMPLETED' ? 'done' : 'upcoming',
    },
  ];
}

export function OrderProgress({
  order,
}: {
  order: Pick<MasterOrder, 'status' | 'createdAt' | 'payment' | 'subOrders'>;
}) {
  const steps = buildOrderSteps(order);
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Tiến độ đơn hàng">
      {steps.map((step) => (
        <li
          key={step.title}
          className="flex items-start gap-2"
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <span
            aria-hidden
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
              step.state === 'done'
                ? 'border-primary-900 bg-primary-900 text-white'
                : step.state === 'failed'
                  ? 'border-red-600 bg-red-600 text-white'
                  : step.state === 'current'
                    ? 'border-primary-900 bg-white'
                    : 'border-gray-400 bg-white'
            }`}
          >
            {step.state === 'done' && <Check className="size-3" strokeWidth={3} />}
            {step.state === 'failed' && <X className="size-3" strokeWidth={3} />}
            {step.state === 'current' && <span className="size-2 rounded-full bg-primary-900" />}
          </span>
          <div className="text-sm">
            <p
              className={`font-semibold ${
                step.state === 'failed'
                  ? 'text-red-800'
                  : step.state === 'upcoming'
                    ? 'text-gray-600'
                    : 'text-gray-900'
              }`}
            >
              {step.title}
              <span className="sr-only">
                {
                  {
                    done: ' — đã xong',
                    current: ' — đang diễn ra',
                    failed: ' — đã hủy',
                    upcoming: ' — chưa tới',
                  }[step.state]
                }
              </span>
            </p>
            {step.detail && <p className="text-xs text-gray-700">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const orderCode = (id: string) => `GS-${id.slice(0, 8).toUpperCase()}`;
