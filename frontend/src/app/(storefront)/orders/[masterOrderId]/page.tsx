import { MasterOrderDetail } from '../../../../features/cart-order/components/master-order-detail';

export default async function OrderPage({
  params,
}: {
  params: Promise<{ masterOrderId: string }>;
}) {
  const { masterOrderId } = await params;
  return <MasterOrderDetail id={masterOrderId} />;
}
