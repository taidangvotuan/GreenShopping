import { Logger } from '@nestjs/common';
import { z } from 'zod';

/** BM-01: độ dài tối thiểu của JWT_ACCESS_SECRET khi NODE_ENV=production. */
export const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

/** BM-03: access token ngắn hạn (logout thu hồi ngay qua bảng revoked_token). */
export const DEFAULT_ACCESS_TOKEN_TTL = '30m';

/** Cú pháp thời hạn token được chấp nhận: số nguyên dương + s | m | h | d (vd. 15m, 1h). */
const TOKEN_TTL_REGEX = /^[1-9]\d*[smhd]$/;

/**
 * Giá trị mẫu/dễ đoán bị cấm ở production (so sánh không phân biệt hoa thường),
 * gồm cả giá trị đang có trong backend/.env.example.
 */
const WEAK_JWT_SECRETS = new Set([
  'change_me_access_secret',
  'change_me_refresh_secret',
  'secret',
  'changeme',
  'change_me',
  'jwt_secret',
  'jwtsecret',
  'jwt-secret',
  'your_jwt_secret',
  'your-jwt-secret',
  'your_secret',
  'mysecret',
  'secretkey',
  'secret_key',
  'supersecret',
  'password',
  'default',
  'test',
  'dev',
  'development',
  'greenshopping',
]);

/** Dấu hiệu chuỗi giữ chỗ chưa được thay bằng khóa thật. */
const PLACEHOLDER_PATTERN = /change[_-]?me|replace[_-]?me|your[_-]?(jwt[_-]?)?secret|example|placeholder/i;

/** Lý do JWT secret không đủ an toàn cho production (mảng rỗng = đạt). */
export function weakJwtSecretReasons(secret: string): string[] {
  const reasons: string[] = [];
  if (secret.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
    reasons.push(`ngắn hơn ${MIN_PRODUCTION_JWT_SECRET_LENGTH} ký tự`);
  }
  if (WEAK_JWT_SECRETS.has(secret.trim().toLowerCase()) || PLACEHOLDER_PATTERN.test(secret)) {
    reasons.push('là giá trị mẫu hoặc dễ đoán');
  }
  if (new Set(secret).size < 10) {
    reasons.push('có quá ít ký tự khác nhau');
  }
  return reasons;
}

/**
 * Kiểm tra biến môi trường ngay khi khởi động (ConfigModule.forRoot({ validate })).
 * Thiếu/sai cấu hình → ứng dụng dừng sớm với thông báo rõ ràng thay vì lỗi lúc chạy.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),

    DATABASE_URL: z
      .string()
      .startsWith('mysql://', 'DATABASE_URL phải là chuỗi kết nối MySQL (mysql://...)'),

    // Ở production còn phải qua weakJwtSecretReasons() (xem superRefine bên dưới)
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET cần tối thiểu 16 ký tự'),
    JWT_ACCESS_EXPIRES_IN: z
      .string()
      .trim()
      .regex(TOKEN_TTL_REGEX, 'JWT_ACCESS_EXPIRES_IN phải có dạng <số><s|m|h|d>, ví dụ 30m')
      .default(DEFAULT_ACCESS_TOKEN_TTL),

    // Muối của định dạng băm SHA-256 CŨ — chỉ còn dùng để xác minh và nâng cấp hash cũ sang bcrypt
    PASSWORD_SALT: z.string().min(16, 'PASSWORD_SALT cần tối thiểu 16 ký tự'),

    // NV-01: cổng thanh toán mô phỏng TẮT mặc định; chỉ bật tường minh cho dev/demo
    PAYMENT_MOCK_ENABLED: z
      .enum(['true', 'false'], { message: 'PAYMENT_MOCK_ENABLED chỉ nhận "true" hoặc "false"' })
      .optional()
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const reasons = weakJwtSecretReasons(env.JWT_ACCESS_SECRET);
    if (reasons.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: `không được dùng ở production: ${reasons.join(', ')}. Sinh khóa ngẫu nhiên ≥ ${MIN_PRODUCTION_JWT_SECRET_LENGTH} ký tự.`,
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

const logger = new Logger('EnvValidation');

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${issues}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === 'development') {
    const reasons = weakJwtSecretReasons(env.JWT_ACCESS_SECRET);
    if (reasons.length) {
      logger.warn(
        `JWT_ACCESS_SECRET ${reasons.join(', ')} — chỉ chấp nhận khi phát triển, NODE_ENV=production sẽ từ chối khởi động.`,
      );
    }
  }
  if (env.NODE_ENV === 'production' && env.PAYMENT_MOCK_ENABLED) {
    logger.warn('PAYMENT_MOCK_ENABLED=true ở production: cổng thanh toán mô phỏng đang được bật.');
  }
  return env;
}
