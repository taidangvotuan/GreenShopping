'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../../shared/lib/api-client';
import { getPostLoginRedirect, LOGIN_PATH } from '../../../shared/lib/route-permissions';
import { tokenStorage } from '../../../shared/lib/token-storage';
import { authApi } from '../services/auth-api';
import type { LoginPayload, RegisterPayload } from '../types';
import { currentUserQueryKey } from './use-current-user';

/** Đăng nhập → lưu cookie → điều hướng theo role (ADMIN > STAFF > SELLER > CUSTOMER). */
export function useLogin(redirect?: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: ({ access_token, user }) => {
      tokenStorage.setSession(access_token, user.roles);
      queryClient.setQueryData(currentUserQueryKey, user);
      toast.success(`Xin chào, ${user.fullName}!`);
      router.replace(getPostLoginRedirect(user.roles, redirect));
      router.refresh();
    },
  });
}

/** Đăng ký → chuyển sang trang đăng nhập. */
export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (user) => {
      toast.success('Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.');
      router.replace(`${LOGIN_PATH}?registered=${encodeURIComponent(user.email)}`);
    },
  });
}

/** Đăng xuất: ghi nhật ký phía server (nếu được), luôn xóa phiên phía client. */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch {
        /* token đã hết hạn vẫn cho đăng xuất phía client */
      }
    },
    onSettled: () => {
      tokenStorage.clear();
      queryClient.clear();
      toast.success('Đã đăng xuất');
      router.replace(LOGIN_PATH);
      router.refresh();
    },
  });
}

export { getApiErrorMessage };
