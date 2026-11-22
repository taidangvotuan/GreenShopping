'use client';

import Link from 'next/link';
import { LogoutButton, useCurrentUser } from '../../features/auth-user';

// TODO(shop-product): thay bằng trang chủ thật (sản phẩm nổi bật, danh mục...).
export default function HomePage() {
  const { user, isResolving } = useCurrentUser();

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-primary-900">Green Shopping</h1>
      <p className="text-gray-600">Sàn thương mại điện tử dành cho sản phẩm xanh</p>
      <Link href="/products" className="rounded-lg bg-primary-900 px-4 py-2 font-semibold text-white">Khám phá sản phẩm</Link>
      {isResolving ? null : user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Xin chào, <b>{user.fullName}</b> ({user.roles.join(', ')})
          </span>
          <LogoutButton />
        </div>
      ) : (
        <div className="flex gap-3">
          <Link href="/login" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Đăng nhập
          </Link>
          <Link href="/register" className="rounded-lg border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50">
            Đăng ký
          </Link>
        </div>
      )}
    </section>
  );
}
