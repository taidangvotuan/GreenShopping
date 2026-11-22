import type { ReactNode } from 'react';
import { LogoutButton, RoleGuard } from '../../../features/auth-user';
import { AdminSidebar } from '../../../shared/components/layout/admin-sidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['ADMIN', 'STAFF']}>
      <div className="flex min-h-screen flex-col bg-[#f6f7f8]">
        <header className="flex items-center justify-between border-b border-primary-100 bg-white px-6 py-3">
          <span className="font-semibold text-primary-800">Green Shopping · Quản trị</span>
          <LogoutButton />
        </header>
        <div className="flex flex-1 flex-col md:flex-row">
          <AdminSidebar />
          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </RoleGuard>
  );
}
