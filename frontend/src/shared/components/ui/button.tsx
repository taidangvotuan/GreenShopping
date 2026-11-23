import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn.util';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
}

// Màu theo token Figma: bg-brand-primary #14532d (primary-900), border-default #d1d5db (gray-300)
const variants: Record<Variant, string> = {
  primary: 'bg-primary-900 text-white hover:bg-primary-800 focus-visible:ring-primary-500',
  outline:
    'border border-gray-300 text-primary-900 bg-white hover:bg-primary-50 focus-visible:ring-primary-500',
  ghost: 'text-primary-900 hover:bg-primary-50 focus-visible:ring-primary-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-11 px-4 text-sm', // cao bằng Input để thẳng hàng (ô voucher + nút Áp dụng)
  lg: 'h-11 px-6 text-sm font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
