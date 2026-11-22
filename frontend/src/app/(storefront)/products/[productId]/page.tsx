import { ProductDetail } from '../../../../features/shop-product/components/product-detail';

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <ProductDetail id={productId} />;
}
