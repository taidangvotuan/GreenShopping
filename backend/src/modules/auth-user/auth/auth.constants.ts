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
/** Định dạng ngày sinh gửi lên: YYYY-MM-DD (giá trị của <input type="date">). */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** Ngày sinh sớm nhất được chấp nhận. */
export const MIN_BIRTH_DATE = '1900-01-01';

/** Vai trò được phép chọn khi đăng ký (whitelist — mọi giá trị khác bị từ chối 400). */
export const REGISTERABLE_ROLES = ['CUSTOMER', 'SELLER', 'STAFF', 'ADMIN'] as const;
export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

/** Chuẩn hóa SĐT về dạng 0xxxxxxxxx để lưu và so trùng nhất quán. */
export function normalizeVnPhone(phone: string): string {
  return phone.startsWith('+84') ? `0${phone.slice(3)}` : phone;
}

/** Trim 2 đầu (chỉ áp dụng cho chuỗi) — dùng trong @Transform. */
export function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Họ tên / Địa chỉ: trim 2 đầu và gộp nhiều khoảng trắng liên tiếp thành 1
 * (cho phép khoảng trắng NGĂN CÁCH giữa các từ; chuỗi toàn khoảng trắng → rỗng → bị @IsNotEmpty chặn).
 */
export function collapseSpaces({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}

/** Ngày hiện tại theo giờ Việt Nam, dạng YYYY-MM-DD (so sánh chuỗi ISO an toàn). */
export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

/** Ngày sinh hợp lệ: đúng YYYY-MM-DD, là ngày có thật trên lịch, trong [1900-01-01, hôm nay]. */
export function isValidBirthDate(value: unknown, now = new Date()): boolean {
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const isRealDate =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return isRealDate && value >= MIN_BIRTH_DATE && value <= todayInVietnam(now);
}
