'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '../../../features/auth-user';

export function AdminSidebar() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const entries = [
    { href: '/admin/dashboard', label: 'Tổng quan' },
    { href: '/admin/shipments', label: 'Tiến độ giao hàng' },
    ...(user?.roles.includes('ADMIN')
      ? [
          { href: '/admin/promotions', label: 'Quản lý ưu đãi' },
          { href: '/admin/payments', label: 'Quản lý thanh toán' },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Quản trị"
      className="flex flex-wrap gap-1 border-b border-gray-200 bg-white p-3 md:w-56 md:shrink-0 md:flex-col md:border-b-0 md:border-r"
    >
      {entries.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className={`rounded-lg px-3 py-2 text-sm hover:bg-primary-50 ${pathname === href ? 'bg-primary-100 font-semibold text-primary-900' : 'text-gray-700'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
