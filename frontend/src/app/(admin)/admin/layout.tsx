import type { ReactNode } from 'react';
import { LogoutButton, RoleGuard } from '../../../features/auth-user';

// TODO(admin): thay bằng layout thật (AdminSidebar). Hiện chỉ dựng khung + chặn quyền.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['ADMIN', 'STAFF']}>
      <div className="min-h-screen">
        <header className="flex items-center justify-between border-b border-primary-100 bg-white px-6 py-3">
          <span className="font-semibold text-primary-800">Green Shopping · Quản trị</span>
          <LogoutButton />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </RoleGuard>
  );
}
