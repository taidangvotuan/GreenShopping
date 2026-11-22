import { CheckoutForm } from '../../../features/cart-order/components/checkout-form';

type Search = Record<string, string | string[] | undefined>;

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { product, quantity, item, voucher, points } = await searchParams;
  const source =
    typeof product === 'string'
      ? { buyNow: { productId: product, quantity: Number(quantity ?? 1) } }
      : { cartItemIds: typeof item === 'string' ? [item] : item };
  const initialDiscounts = {
    voucherCode: typeof voucher === 'string' ? voucher : undefined,
    points: typeof points === 'string' ? Number(points) : undefined,
  };
  return (
    <CheckoutForm
      key={JSON.stringify([source, initialDiscounts])}
      source={source}
      initialDiscounts={initialDiscounts}
    />
  );
}
