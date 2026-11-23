'use client';

import Link from 'next/link';
import { useCurrentUser } from '../../../../features/auth-user';
import { getPrimaryRole } from '../../../../shared/lib/route-permissions';

// TODO(reports): thay bằng số liệu thật (Figma: Screens/Dashboard/Staff/Overview & Admin/Overview).
export default function AdminDashboardPage() {
  const { user } = useCurrentUser();
  const isAdmin = getPrimaryRole(user?.roles ?? []) === 'ADMIN';

  const shortcuts = isAdmin
    ? [
        { href: '/admin/promotions', label: 'Quản lý ưu đãi (voucher)' },
        { href: '/admin/payments', label: 'Quản lý thanh toán' },
        { href: '/admin/shipments', label: 'Tiến độ giao hàng' },
      ]
    : [{ href: '/admin/shipments', label: 'Cập nhật tiến độ giao hàng' }];

  return (
    <section className="space-y-5">
      <header>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white ${isAdmin ? 'bg-gray-900' : 'bg-teal-700'}`}
        >
          {isAdmin ? 'ADMIN' : 'STAFF'}
        </span>
        <h1 className="mt-2 text-2xl font-bold text-primary-900">
          {isAdmin ? 'Bảng điều khiển quản trị' : 'Bảng điều khiển nhân viên vận hành'}
        </h1>
        {user && <p className="mt-1 text-sm text-gray-600">Xin chào, {user.fullName}</p>}
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-xl border border-gray-200 bg-white p-5 font-semibold text-primary-900 hover:border-primary-900"
            >
              {item.label} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
