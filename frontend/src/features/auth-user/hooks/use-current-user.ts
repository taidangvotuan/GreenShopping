'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { tokenStorage } from '../../../shared/lib/token-storage';
import { authApi } from '../services/auth-api';

export const currentUserQueryKey = ['auth', 'me'] as const;

/**
 * Thông tin user đang đăng nhập (GET /auth/me).
 * Chỉ gọi API khi có token trong cookie; 401 được api-client xử lý (xóa cookie + về /login).
 */
export function useCurrentUser() {
  // Đọc cookie sau khi mount để tránh lệch HTML giữa server và client (hydration)
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => setHasToken(!!tokenStorage.getAccessToken()), []);

  const query = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: authApi.me,
    enabled: hasToken === true,
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    user: query.data ?? null,
    isAuthenticated: hasToken === true && !!query.data,
    // Đang xác định trạng thái: chưa đọc cookie, hoặc có token nhưng chưa có dữ liệu
    isResolving: hasToken === null || (hasToken && query.isPending),
  };
}
