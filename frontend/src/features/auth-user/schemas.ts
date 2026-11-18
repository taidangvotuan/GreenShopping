import { z } from 'zod';

/**
 * Quy tắc validation — KHỚP 100% với backend:
 *   backend/src/modules/auth-user/auth/dto/register.dto.ts
 *   backend/src/modules/auth-user/auth/dto/login.dto.ts
 *   backend/src/modules/auth-user/auth/auth.constants.ts
 */
export const VN_PHONE_REGEX = /^(?:0\d{9}|\+84\d{9})$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])\S{8,}$/;
const NO_WHITESPACE_REGEX = /^\S+$/;

const passwordField = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự')
  .regex(NO_WHITESPACE_REGEX, 'Mật khẩu không được chứa khoảng trắng')
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
      .max(150, 'Họ tên tối đa 150 ký tự'),
    email: z
      .string()
      .min(1, 'Vui lòng nhập email')
      .max(255, 'Email tối đa 255 ký tự')
      .regex(NO_WHITESPACE_REGEX, 'Email không được chứa khoảng trắng')
      .email('Email không đúng định dạng')
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .min(1, 'Vui lòng nhập số điện thoại')
      .max(20)
      .regex(NO_WHITESPACE_REGEX, 'Số điện thoại không được chứa khoảng trắng')
      .regex(VN_PHONE_REGEX, 'Số điện thoại gồm 10 chữ số bắt đầu bằng 0 hoặc dạng +84'),
    password: passwordField,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
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
    .max(255),
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
