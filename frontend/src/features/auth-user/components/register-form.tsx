'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X } from 'lucide-react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { getApiErrorMessage } from '../../../shared/lib/api-client';
import { cn } from '../../../shared/utils/cn.util';
import { useRegister } from '../hooks/use-auth';
import { registerSchema, type RegisterFormInput, type RegisterFormValues } from '../schemas';

const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'Tối thiểu 8 ký tự', test: (v) => v.length >= 8 },
  { label: 'Có chữ hoa (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Có chữ thường (a-z)', test: (v) => /[a-z]/.test(v) },
  { label: 'Có chữ số (0-9)', test: (v) => /\d/.test(v) },
  { label: 'Có ký tự đặc biệt (!@#$%^&*)', test: (v) => /[!@#$%^&*]/.test(v) },
  { label: 'Không chứa khoảng trắng', test: (v) => v.length > 0 && !/\s/.test(v) },
];

export function RegisterForm() {
  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  const password = useWatch({ control, name: 'password' }) ?? '';

  // Không gửi confirmPassword (backend forbidNonWhitelisted sẽ từ chối trường thừa)
  const onSubmit = ({ confirmPassword: _confirm, ...payload }: RegisterFormValues) =>
    registerMutation.mutate(payload);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {registerMutation.isError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {getApiErrorMessage(registerMutation.error)}
        </p>
      )}

      <Input
        label="Họ và tên"
        autoComplete="name"
        placeholder="Nguyễn Văn A"
        maxLength={150}
        required
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="ban@example.com"
        maxLength={255}
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        placeholder="0912345678"
        maxLength={20}
        required
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Input
        label="Mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        error={errors.password?.message}
        {...register('password')}
      />
      <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-label="Yêu cầu mật khẩu">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.label}
              className={cn('flex items-center gap-1.5', ok ? 'text-primary-700' : 'text-gray-500')}
            >
              {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
      <Input
        label="Xác nhận mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button
        type="submit"
        size="lg"
        fullWidth
        isLoading={registerMutation.isPending}
        disabled={!isValid || registerMutation.isPending}
      >
        Tạo tài khoản
      </Button>

      <p className="text-center text-sm text-gray-600">
        Đã có tài khoản?{' '}
        <Link href="/login" className="font-medium text-primary-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
