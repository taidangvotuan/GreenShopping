'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {registeredEmail && !login.isError && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800">
          Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu mua sắm xanh!
        </p>
      )}
      {login.isError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {getApiErrorMessage(login.error)}
        </p>
      )}

      <Input
        label="Email hoặc Số điện thoại"
        autoComplete="username"
        placeholder="ban@example.com hoặc 0912345678"
        required
        error={errors.identifier?.message}
        {...register('identifier')}
      />
      <Input
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
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

      <p className="text-center text-sm text-gray-600">
        Chưa có tài khoản?{' '}
        <Link
          href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
          className="font-medium text-primary-700 hover:underline"
        >
          Đăng ký ngay
        </Link>
      </p>
    </form>
  );
}
