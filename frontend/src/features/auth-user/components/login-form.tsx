'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { ShopIcon } from '../../../shared/components/ui/shop-icon';
import { getApiErrorMessage } from '../../../shared/lib/api-client';
import { useLogin } from '../hooks/use-auth';
import { loginSchema, type LoginFormInput, type LoginFormValues } from '../schemas';

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const registeredEmail = searchParams.get('registered');

  const login = useLogin(redirect);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { identifier: registeredEmail ?? '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => login.mutate(values);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {redirect && !login.isError && !registeredEmail && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Vui lòng đăng nhập để tiếp tục thao tác này.
        </p>
      )}
      {registeredEmail && !login.isError && (
        <p role="status" className="rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-900">
          Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu mua sắm xanh!
        </p>
      )}
      {login.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {getApiErrorMessage(login.error)}
        </p>
      )}

      <Input
        label="Email hoặc số điện thoại"
        autoComplete="username"
        placeholder="minhanh@example.com hoặc 0912345678"
        error={errors.identifier?.message}
        {...register('identifier')}
      />
      <Input
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      <Button
        type="submit"
        size="lg"
        fullWidth
        isLoading={login.isPending}
        disabled={!isValid || login.isPending}
      >
        Đăng nhập
      </Button>

      <div className="border-t border-gray-200 pt-5">
        <Link
          href="/"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-semibold text-primary-900 hover:bg-primary-50"
        >
          Tiếp tục với tư cách khách
        </Link>
      </div>

      <div className="flex gap-3 rounded-lg bg-primary-100 p-4 text-sm text-primary-900">
        <ShopIcon name="shield" />
        <div>
          <p className="font-semibold">Green Coins gắn với tài khoản</p>
          <p className="mt-1 text-xs text-gray-700">
            Khách chưa đăng nhập không xem được Điểm xanh và không thể đặt hàng. Đăng xuất không xóa
            điểm hoặc lịch sử.
          </p>
        </div>
      </div>
    </form>
  );
}
