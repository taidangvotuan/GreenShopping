import { z } from 'zod';

/**
 * Quy tắc validation — KHỚP 100% với backend:
 *   backend/src/modules/auth-user/auth/dto/register.dto.ts
 *   backend/src/modules/auth-user/auth/dto/login.dto.ts
 *   backend/src/modules/auth-user/auth/auth.constants.ts
 *
 * Quy tắc khoảng trắng:
 *  - Mọi trường: trim 2 đầu, từ chối chuỗi rỗng / toàn khoảng trắng.
 *  - Họ tên, Địa chỉ: cho phép khoảng trắng giữa các từ (gộp nhiều khoảng trắng thành 1).
 *  - Email, SĐT: cấm khoảng trắng ở giữa chuỗi.
 *  - Mật khẩu: không trim, cấm khoảng trắng ở MỌI vị trí.
 */
export const VN_PHONE_REGEX = /^(?:0\d{9}|\+84\d{9})$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])\S{8,}$/;
const NO_WHITESPACE_REGEX = /^\S+$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MIN_BIRTH_DATE = '1900-01-01';
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const collapseSpaces = (v: string) => v.replace(/\s+/g, ' ');

/** Ngày hiện tại theo giờ Việt Nam (YYYY-MM-DD) — giống backend todayInVietnam(). */
export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
}

/** Ngày có thật trên lịch, trong [1900-01-01, hôm nay]. */
export function isValidBirthDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const isRealDate =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return isRealDate && value >= MIN_BIRTH_DATE && value <= todayInVietnam();
}

export const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'Ít nhất 8 ký tự', test: (v) => v.length >= 8 },
  {
    label: 'Chữ hoa & chữ thường',
    test: (v) => /[A-Z]/.test(v) && /[a-z]/.test(v),
  },
  { label: 'Có chữ số', test: (v) => /\d/.test(v) },
  {
    label: 'Có ký tự đặc biệt (!@#$%^&*)',
    test: (v) => /[!@#$%^&*]/.test(v),
  },
  {
    label: 'Không chứa khoảng trắng',
    test: (v) => v.length > 0 && !/\s/.test(v),
  },
];

const passwordField = z
  .string()
  .min(1, 'Vui lòng nhập mật khẩu')
  .regex(NO_WHITESPACE_REGEX, 'Mật khẩu không được chứa khoảng trắng')
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu cần ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu cần ít nhất 1 chữ thường')
  .regex(/\d/, 'Mật khẩu cần ít nhất 1 chữ số')
  .regex(/[!@#$%^&*]/, 'Mật khẩu cần ít nhất 1 ký tự đặc biệt (!@#$%^&*)');

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập họ tên')
      .max(150, 'Họ tên tối đa 150 ký tự')
      .transform(collapseSpaces),
    dateOfBirth: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập ngày sinh')
      .refine(isValidBirthDate, 'Ngày sinh không hợp lệ hoặc lớn hơn ngày hiện tại'),
    phone: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập số điện thoại')
      .max(20)
      .regex(NO_WHITESPACE_REGEX, 'Số điện thoại không được chứa khoảng trắng')
      .regex(VN_PHONE_REGEX, 'Số điện thoại gồm 10 chữ số bắt đầu bằng 0 hoặc dạng +84'),
    address: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập địa chỉ')
      .max(255, 'Địa chỉ tối đa 255 ký tự')
      .transform(collapseSpaces),
    email: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập email')
      .max(255, 'Email tối đa 255 ký tự')
      .regex(NO_WHITESPACE_REGEX, 'Email không được chứa khoảng trắng')
      .email('Email không đúng định dạng')
      .transform((v) => v.toLowerCase()),
    password: passwordField,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
    // Không có trường vai trò: đăng ký công khai luôn là Khách hàng (backend gán CUSTOMER, gửi role → 400)
    // Chỉ ở giao diện (Figma): bắt buộc đồng ý quy định trước khi tạo tài khoản
    acceptTerms: z.boolean().refine((v) => v, 'Bạn cần đồng ý với quy định sử dụng'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  });

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập Email hoặc Số điện thoại')
    .max(255)
    .regex(NO_WHITESPACE_REGEX, 'Email/Số điện thoại không được chứa khoảng trắng')
    .refine(
      (v) => (v.includes('@') ? SIMPLE_EMAIL_REGEX.test(v) : VN_PHONE_REGEX.test(v)),
      'Email hoặc số điện thoại không đúng định dạng',
    ),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu')
    .max(128)
    .regex(NO_WHITESPACE_REGEX, 'Mật khẩu không được chứa khoảng trắng'),
});

export type RegisterFormInput = z.input<typeof registerSchema>;
export type RegisterFormValues = z.output<typeof registerSchema>;
export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.output<typeof loginSchema>;
