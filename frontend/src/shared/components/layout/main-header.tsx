'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { LogoutButton, useCurrentUser } from '../../../features/auth-user';
import { cartApi, cartKey } from '../../../features/cart-order/services/cart-api';
import { getHomeForRoles } from '../../lib/route-permissions';
import { ShopIcon } from '../ui/shop-icon';

export function MainHeader() {
  const { user, isAuthenticated } = useCurrentUser();
  const cart = useQuery({ queryKey: cartKey, queryFn: cartApi.list, enabled: isAuthenticated });
  const count = cart.data?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const dashboard = user ? getHomeForRoles(user.roles) : '/';

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="bg-primary-100 px-3 py-1 text-center text-xs text-primary-900">
        Chọn tốt cho bạn. Nhẹ hơn cho hành tinh.
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-semibold text-primary-900"
        >
          <ShopIcon name="brand" /> green shopping
        </Link>
        <form
          action="/products"
          className="order-last flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 md:order-none md:w-auto md:flex-1"
        >
          <button type="submit" aria-label="Tìm kiếm sản phẩm" className="py-2">
            <ShopIcon name="search" />
          </button>
          <input
            name="q"
            aria-label="Tìm sản phẩm, cửa hàng"
            placeholder="Tìm sản phẩm, cửa hàng…"
            className="min-w-0 flex-1 py-2 text-sm outline-none"
          />
        </form>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/cart" className="flex items-center gap-1.5 font-semibold">
            <ShopIcon name="cart" /> Giỏ hàng{count > 0 ? ` (${count})` : ''}
          </Link>
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <ShopIcon name="user" />
              <span>{user.fullName}</span>
              <LogoutButton />
            </div>
          ) : (
            <Link href="/login">Đăng nhập</Link>
          )}
        </div>
      </div>
      <nav aria-label="Mua sắm" className="border-t border-gray-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm text-gray-700 sm:px-6">
          <Link href="/products">Khám phá</Link>
          <Link href="/orders">Đơn hàng</Link>
          {dashboard !== '/' && <Link href={dashboard}>Bảng điều khiển</Link>}
          {user && (
            <div className="sm:hidden">
              <LogoutButton />
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
