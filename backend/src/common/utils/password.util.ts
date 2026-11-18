import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Băm mật khẩu theo đặc tả đồ án.
 * FIXME: Production nên dùng bcrypt/argon2; dùng SHA-256 + SALT theo đặc tả đồ án
 */
export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

/** So sánh hằng thời gian (timingSafeEqual) để chống tấn công đo thời gian phản hồi. */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
