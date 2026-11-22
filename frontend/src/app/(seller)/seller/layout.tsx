import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogoutButton, RoleGuard } from '../../../features/auth-user';

// TODO(shop-product): thay bằng layout thật (SellerSidebar). Hiện chỉ dựng khung + chặn quyền.
export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['SELLER', 'ADMIN']}>
      <div className="min-h-screen">
        <header className="flex items-center justify-between border-b border-primary-100 bg-white px-6 py-3">
          <span className="font-semibold text-primary-800">Green Shopping · Kênh người bán</span>
          <LogoutButton />
        </header>
        <nav className="flex flex-wrap gap-4 border-b border-gray-200 bg-white px-6 py-3 text-sm font-medium text-primary-900" aria-label="Kênh người bán">
          <Link href="/seller/dashboard">Tổng quan</Link>
          <Link href="/seller/shipments">Tiến độ giao hàng</Link>
        </nav>
        <main className="p-6">{children}</main>
      </div>
    </RoleGuard>
  );
}
