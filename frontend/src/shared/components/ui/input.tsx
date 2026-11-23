'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn.util';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Ô nhập có nhãn, thông báo lỗi; type="password" tự có nút hiện/ẩn. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, type = 'text', className, required, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-gray-900">
          {label}
          {required && <span className="ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(
            'h-11 w-full rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400',
            'transition-colors focus:outline-none focus:ring-2',
            error
              ? 'border-red-500 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-primary-900 focus:ring-primary-100',
            isPassword && 'pr-10',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-primary-700"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-gray-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
