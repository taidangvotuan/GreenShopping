'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { getApiErrorMessage } from '../../../shared/lib/api-client';
import { cn } from '../../../shared/utils/cn.util';
import { useRegister } from '../hooks/use-auth';
import {
  PASSWORD_RULES,
  registerSchema,
  todayInVietnam,
  type RegisterFormInput,
  type RegisterFormValues,
} from '../schemas';

/** 4 vạch độ mạnh theo Figma: độ dài · hoa & thường · số · ký tự đặc biệt. */
function PasswordStrength({ password }: { password: string }) {
  const score = PASSWORD_RULES.slice(0, 4).filter((rule) => rule.test(password)).length;
  const label = !password
    ? ''
    : score === 4
      ? 'Mật khẩu mạnh'
      : score >= 2
        ? 'Mật khẩu trung bình'
        : 'Mật khẩu yếu';
  const tone = score === 4 ? 'bg-primary-900' : score >= 2 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1 rounded-full', i < score ? tone : 'bg-gray-200')} />
        ))}
      </div>
      {label && (
        <p
          className={cn(
            'text-xs font-semibold',
            score === 4 ? 'text-primary-900' : 'text-gray-700',
          )}
        >
          {label}
        </p>
      )}
      <ul
        className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2"
        aria-label="Yêu cầu mật khẩu"
      >
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.label}
              className={cn('flex items-center gap-1.5', ok ? 'text-primary-900' : 'text-gray-500')}
            >
              <Check className={cn('h-3.5 w-3.5', !ok && 'opacity-30')} aria-hidden />
              <span>
                {rule.label}
                <span className="sr-only">{ok ? ' — đạt' : ' — chưa đạt'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
    defaultValues: {
      fullName: '',
      dateOfBirth: '',
      phone: '',
      address: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const password = useWatch({ control, name: 'password' }) ?? '';

  // acceptTerms chỉ dùng ở giao diện; confirmPassword gửi lên để backend kiểm tra lại.
  // Không gửi vai trò: tài khoản đăng ký công khai luôn là Khách hàng (BM-06).
  const onSubmit = ({ acceptTerms: _terms, ...payload }: RegisterFormValues) =>
    registerMutation.mutate(payload);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {registerMutation.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {getApiErrorMessage(registerMutation.error)}
        </p>
      )}

      <Input
        label="Họ và tên"
        autoComplete="name"
        placeholder="Nguyễn Hoài An"
        maxLength={150}
        required
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Ngày sinh"
          type="date"
          autoComplete="bday"
          min="1900-01-01"
          max={todayInVietnam()}
          required
          error={errors.dateOfBirth?.message}
          {...register('dateOfBirth')}
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
      </div>
      <Input
        label="Địa chỉ"
        autoComplete="street-address"
        placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
        maxLength={255}
        required
        error={errors.address?.message}
        {...register('address')}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="hoaian@example.com"
        maxLength={255}
        required
        hint="Dùng để đăng nhập và nhận thông tin đơn hàng."
        error={errors.email?.message}
        {...register('email')}
      />
      <div className="space-y-3">
        <Input
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordStrength password={password} />
      </div>
      <Input
        label="Xác nhận mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        hint="Nhập lại mật khẩu để xác nhận."
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <div className="space-y-1">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-900">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary-900"
            {...register('acceptTerms')}
          />
          <span>Tôi đồng ý với quy định sử dụng của Green Shopping. *</span>
        </label>
        {errors.acceptTerms?.message && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {errors.acceptTerms.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        fullWidth
        isLoading={registerMutation.isPending}
        disabled={!isValid || registerMutation.isPending}
      >
        Tạo tài khoản xanh
      </Button>

      <p className="border-t border-gray-200 pt-4 text-xs text-gray-600">
        * Thông tin bắt buộc. Mật khẩu được băm trước khi lưu.
      </p>
    </form>
  );
}
