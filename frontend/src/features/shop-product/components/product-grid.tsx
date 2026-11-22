'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { money } from '../../cart-order/components/checkout-summary';
import { productApi } from '../services/product-api';

export function ProductGrid({ search }: { search: string }) {
  const products = useQuery({ queryKey: ['products'], queryFn: productApi.list });
  const term = search.toLocaleLowerCase('vi');
  const matches = products.data?.filter((product) =>
    `${product.name} ${product.shop.name}`.toLocaleLowerCase('vi').includes(term),
  );
  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Khám phá sản phẩm</h1>
      {search && <p className="text-gray-600">Kết quả tìm kiếm cho “{search}”</p>}
      {products.isPending && <p role="status">Đang tải sản phẩm…</p>}
      <ErrorMessage error={products.error} />
      {matches?.length === 0 && <p>Chưa có sản phẩm phù hợp.</p>}
      <div className="grid grid-cols-1 gap-4 min-[450px]:grid-cols-2 lg:grid-cols-3">
        {matches?.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white hover:border-primary-600"
          >
            {product.imageUrl && (
              <img src={product.imageUrl} alt="" className="aspect-[4/3] w-full object-cover" />
            )}
            <div className="space-y-1 p-4">
              <p className="text-sm text-gray-600">{product.shop.name}</p>
              <h2 className="font-semibold">{product.name}</h2>
              <p className="font-semibold text-primary-900">{money(product.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
