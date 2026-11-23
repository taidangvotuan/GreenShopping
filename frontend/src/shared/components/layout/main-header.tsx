'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton, useCurrentUser } from '../../../features/auth-user';
import { cartApi, cartKey } from '../../../features/cart-order/services/cart-api';
import { canPurchase, getHomeForRoles } from '../../lib/route-permissions';
import { ShopIcon } from '../ui/shop-icon';

/**
 * Header storefront (Figma Library/StoreShell):
 *  - Guest: nút "Đăng nhập" (viền) + "Đăng ký" (nền xanh), KHÔNG có giỏ hàng / đơn hàng / điểm xanh.
 *  - Customer: Giỏ hàng (n) + tên tài khoản; menu có "Đơn hàng".
 *  - Seller/Staff/Admin: không mua hàng → thay bằng lối vào bảng điều khiển.
 */
export function MainHeader() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useCurrentUser();
  const isCustomer = canPurchase(user?.roles);
  const cart = useQuery({
    queryKey: cartKey,
    queryFn: cartApi.list,
    enabled: isAuthenticated && isCustomer,
  });
  const count = cart.data?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const dashboard = user ? getHomeForRoles(user.roles) : '/';
  const navLink = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)
      ? 'font-semibold text-primary-900'
      : 'text-gray-700 hover:text-primary-900';

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="bg-primary-100 px-3 py-1.5 text-center text-xs text-primary-900">
        Chọn tốt cho bạn. Nhẹ hơn cho hành tinh. • Thông tin xanh minh bạch, mua sắm an tâm.
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
          className="order-last flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-primary-900 md:order-0 md:w-auto md:flex-1"
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
          {user ? (
            <>
              {isCustomer && (
                <Link href="/cart" className="flex items-center gap-1.5 font-semibold">
                  <ShopIcon name="cart" /> Giỏ hàng
                  {count > 0 ? ` (${count})` : ''}
                </Link>
              )}
              <div className="hidden items-center gap-2 sm:flex">
                <ShopIcon name="user" />
                <span>{user.fullName}</span>
                <LogoutButton />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-lg border border-primary-900 px-4 font-semibold text-primary-900 hover:bg-primary-50"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-lg bg-primary-900 px-4 font-semibold text-white hover:bg-primary-800"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
      <nav aria-label="Mua sắm" className="border-t border-gray-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 text-sm sm:px-6">
          <Link href="/products" className={navLink('/products')}>
            Khám phá
          </Link>
          {isCustomer && (
            <Link href="/orders" className={navLink('/orders')}>
              Đơn hàng
            </Link>
          )}
          {dashboard !== '/' && (
            <Link href={dashboard} className="text-gray-700 hover:text-primary-900">
              Bảng điều khiển
            </Link>
          )}
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
