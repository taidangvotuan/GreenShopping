'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  buildLoginUrl,
  getHomeForRoles,
  hasAnyRole,
  type RoleName,
} from '../../../shared/lib/route-permissions';
import { useCurrentUser } from '../hooks/use-current-user';

interface RoleGuardProps {
  /** Role được phép; bỏ trống = chỉ cần đăng nhập. */
  allow?: RoleName[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Lớp bảo vệ phía client (bổ sung cho middleware.ts): dùng roles lấy từ GET /auth/me
 * — dữ liệu đã được backend xác minh, không tin cookie.
 */
export function RoleGuard({ allow = [], children, fallback = null }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isResolving, isError } = useCurrentUser();

  const allowed = !!user && hasAnyRole(user.roles, allow);

  useEffect(() => {
    if (isResolving) return;
    if (!user || isError) {
      router.replace(buildLoginUrl(pathname));
    } else if (!allowed) {
      router.replace(getHomeForRoles(user.roles));
    }
  }, [isResolving, user, isError, allowed, router, pathname]);

  if (isResolving || !allowed) {
    return (
      fallback ?? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
          Đang kiểm tra quyền truy cập…
        </div>
      )
    );
  }
  return <>{children}</>;
}
