import Link from 'next/link';
import { PaymentResult } from '../../../../features/payment-refund/components/payment-result';

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { order } = await searchParams;
  return typeof order === 'string' ? (
    <PaymentResult key={order} id={order} />
  ) : (
    <Link href="/orders">Xem đơn hàng của bạn</Link>
  );
}
