'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorMessage } from '../../../shared/components/feedback/error-message';
import { Button } from '../../../shared/components/ui/button';
import { buildLoginUrl, canPurchase } from '../../../shared/lib/route-permissions';
import { useCurrentUser } from '../../auth-user';
import { QuantityPicker } from '../../cart-order/components/cart-item';
import {
  money,
  panel,
  primaryLink,
  secondaryLink,
} from '../../cart-order/components/checkout-summary';
import { cartApi, cartKey } from '../../cart-order/services/cart-api';
import { productApi } from '../services/product-api';
import type { Product } from '../types';

export function ProductDetail({ id }: { id: string }) {
  const product = useQuery({ queryKey: ['products', id], queryFn: () => productApi.get(id) });
  if (product.isPending) return <p role="status">Đang tải sản phẩm…</p>;
  if (product.isError) return <ErrorMessage error={product.error} />;
  return <ProductPurchase key={id} product={product.data} />;
}

function ProductPurchase({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const gallery = product.imageGallery ?? (product.imageUrl ? [product.imageUrl] : []);
  const [imageIndex, setImageIndex] = useState(0);
  const router = useRouter();
  const cache = useQueryClient();
  const add = useMutation({
    mutationFn: () => cartApi.add(product.id, quantity),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: cartKey });
      toast.success('Đã thêm vào giỏ hàng');
    },
  });
  const { user, isResolving } = useCurrentUser();
  const isCustomer = canPurchase(user?.roles);
  const loginHref = buildLoginUrl(`/products/${product.id}`);
  const buyNowHref = `/checkout?product=${product.id}&quantity=${quantity}`;
  const available = product.stock >= quantity;
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        <Link href="/products" className="hover:underline">
          Sản phẩm
        </Link>{' '}
        / {product.name}
      </p>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-[1.15fr_0.9fr_0.65fr]">
        <div>
          {gallery[imageIndex] && (
            <img
              src={gallery[imageIndex]}
              alt={product.name}
              className="aspect-square w-full rounded-xl object-cover"
            />
          )}
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2">
              {gallery.map((image, index) => (
                <button
                  type="button"
                  key={image}
                  aria-pressed={imageIndex === index}
                  aria-label={`Ảnh ${index + 1}`}
                  className={`rounded-lg border-2 p-0.5 ${imageIndex === index ? 'border-primary-800' : 'border-gray-200'}`}
                  onClick={() => setImageIndex(index)}
                >
                  <img src={image} alt="" className="size-14 rounded object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <section className="space-y-4">
          <p className="text-sm font-semibold text-primary-800">{product.shop.name}</p>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-3xl font-bold">{money(product.price)}</p>
          <p className="text-gray-700">{product.description}</p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
            <span className="text-sm">Số lượng · Còn {product.stock} sản phẩm</span>
            <QuantityPicker
              quantity={quantity}
              max={Math.min(product.stock, 99)}
              onChange={setQuantity}
            />
          </div>
        </section>
        <aside className={`${panel} h-fit space-y-3 md:col-span-2 lg:col-span-1`}>
          <h2 className="font-semibold">Lựa chọn của bạn</h2>
          <p className="text-sm text-gray-600">
            {quantity} × {money(product.price)}
          </p>
          <p className="border-y border-gray-200 py-3 text-2xl font-bold">
            {money(Number(product.price) * quantity)}
          </p>
          {isResolving ? (
            <p role="status" className="text-sm text-gray-600">
              Đang kiểm tra tài khoản…
            </p>
          ) : !user ? (
            // Figma Screens/ProductDetail/Guest: không cho thêm giỏ / mua, dẫn sang Đăng nhập.
            // Backend vẫn chặn độc lập: /cart, /checkout yêu cầu JWT + role CUSTOMER.
            <div className="space-y-2 rounded-lg bg-primary-100 p-3">
              <p className="text-sm text-primary-900">Đăng nhập để thêm vào giỏ hàng và đặt mua.</p>
              <button
                type="button"
                className={`${primaryLink} w-full`}
                onClick={() => router.push(loginHref)}
              >
                Đăng nhập để mua hàng
              </button>
              <Link href="/register" className={`${secondaryLink} w-full`}>
                Đăng ký
              </Link>
            </div>
          ) : !isCustomer ? (
            <>
              <Button fullWidth disabled aria-describedby="purchase-role-note">
                Thêm vào giỏ
              </Button>
              <Button fullWidth variant="outline" disabled aria-describedby="purchase-role-note">
                Mua ngay
              </Button>
              <p id="purchase-role-note" role="note" className="text-sm text-gray-600">
                Chỉ tài khoản Khách hàng mới có thể mua hàng.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Ưu đãi, Điểm xanh và phí giao được tính khi xác nhận đơn.
              </p>
              <Button
                fullWidth
                isLoading={add.isPending}
                disabled={!available}
                onClick={() => add.mutate()}
              >
                Thêm vào giỏ
              </Button>
              {available ? (
                <Link href={buyNowHref} className={`${secondaryLink} w-full`}>
                  Mua ngay
                </Link>
              ) : (
                <>
                  <Button fullWidth variant="outline" disabled>
                    Mua ngay
                  </Button>
                  <p role="status" className="text-sm text-red-700">
                    Sản phẩm đã hết hàng.
                  </p>
                </>
              )}
              <ErrorMessage error={add.error} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
