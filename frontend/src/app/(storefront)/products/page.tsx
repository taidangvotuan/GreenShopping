import { ProductGrid } from '../../../features/shop-product/components/product-grid';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  return <ProductGrid search={typeof q === 'string' ? q.trim() : ''} />;
}
