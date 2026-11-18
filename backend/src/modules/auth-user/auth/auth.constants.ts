/** Giá trị cột user.status (VARCHAR(30) theo ERD). */
export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  LOCKED: 'LOCKED',
  PENDING: 'PENDING',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/** Hành động ghi vào audit_log.action. */
export const AUDIT_ACTION = {
  REGISTER: 'REGISTER',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
} as const;

export const DEFAULT_ROLE = 'CUSTOMER';

/** Thông báo chung — KHÔNG tiết lộ email/SĐT có tồn tại hay không. */
export const INVALID_CREDENTIALS_MESSAGE = 'Tên đăng nhập hoặc mật khẩu không đúng';

// ---- Quy tắc validation (frontend zod dùng cùng biểu thức) ----
/** SĐT Việt Nam: 0xxxxxxxxx (10 số) hoặc +84xxxxxxxxx. */
export const VN_PHONE_REGEX = /^(?:0\d{9}|\+84\d{9})$/;
/** ≥ 8 ký tự, có chữ hoa, chữ thường, chữ số, ký tự đặc biệt !@#$%^&*, không khoảng trắng. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])\S{8,}$/;
export const NO_WHITESPACE_REGEX = /^\S+$/;

/** Chuẩn hóa SĐT về dạng 0xxxxxxxxx để lưu và so trùng nhất quán. */
export function normalizeVnPhone(phone: string): string {
  return phone.startsWith('+84') ? `0${phone.slice(3)}` : phone;
}
