import { z } from 'zod';

/**
 * Kiểm tra biến môi trường ngay khi khởi động (ConfigModule.forRoot({ validate })).
 * Thiếu/sai cấu hình → ứng dụng dừng sớm với thông báo rõ ràng thay vì lỗi lúc chạy.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z
    .string()
    .startsWith('mysql://', 'DATABASE_URL phải là chuỗi kết nối MySQL (mysql://...)'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET cần tối thiểu 16 ký tự'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('7d'),

  // Muối băm mật khẩu theo đặc tả đồ án (SHA-256 + SALT)
  PASSWORD_SALT: z.string().min(16, 'PASSWORD_SALT cần tối thiểu 16 ký tự'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${issues}`);
  }
  return parsed.data;
}
