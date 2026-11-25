import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { compare, getRounds, hash } from 'bcrypt';

/**
 * SECURITY (BM-02): băm mật khẩu bằng bcrypt — salt ngẫu nhiên riêng cho từng hash và có hệ số chi phí.
 * Chuỗi lưu tự mô tả thuật toán + cost (`$2b$12$...`, 60 ký tự) nên nâng cost sau này không cần migration.
 *
 * Tương thích ngược: hash cũ SHA-256(password + PASSWORD_SALT) (64 ký tự hex) vẫn xác minh được;
 * khi mật khẩu đúng, AuthService.login tự nâng cấp hash sang bcrypt ngay trong luồng đăng nhập.
 *
 * Giới hạn của thuật toán: bcrypt chỉ dùng 72 byte đầu của mật khẩu.
 */
export const BCRYPT_COST = 12;

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const LEGACY_SHA256_REGEX = /^[a-f0-9]{64}$/i;

export interface PasswordCheck {
  valid: boolean;
  /** Mật khẩu đúng nhưng hash cần nâng cấp (định dạng SHA-256 cũ hoặc bcrypt cost < BCRYPT_COST). */
  needsRehash: boolean;
}

export function isBcryptHash(storedHash: string): boolean {
  return BCRYPT_HASH_REGEX.test(storedHash);
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

/**
 * @deprecated Định dạng cũ (SHA-256 nhanh + muối chung). Chỉ dùng để xác minh hash chưa được nâng cấp,
 * KHÔNG dùng để tạo hash mới.
 */
export function hashLegacyPassword(password: string, salt: string): string {
  return createHash('sha256')
    .update(password + salt)
    .digest('hex');
}

/**
 * Xác minh mật khẩu theo định dạng của hash đang lưu:
 *  - `$2a$` / `$2b$` / `$2y$` → bcrypt.compare
 *  - 64 ký tự hex             → SHA-256 cũ (so sánh hằng thời gian), cần `legacySalt`
 * Mọi nhánh thất bại đều tốn chi phí tương đương một lần bcrypt để khó đo thời gian phản hồi.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  legacySalt?: string,
): Promise<PasswordCheck> {
  if (isBcryptHash(storedHash)) {
    const valid = await compare(password, storedHash);
    return { valid, needsRehash: valid && getRounds(storedHash) < BCRYPT_COST };
  }

  if (legacySalt && LEGACY_SHA256_REGEX.test(storedHash)) {
    const actual = Buffer.from(hashLegacyPassword(password, legacySalt), 'hex');
    const expected = Buffer.from(storedHash, 'hex');
    const valid = actual.length === expected.length && timingSafeEqual(actual, expected);
    if (!valid) await simulatePasswordCheck(password);
    return { valid, needsRehash: valid };
  }

  await simulatePasswordCheck(password);
  return { valid: false, needsRehash: false };
}

let dummyHash: Promise<string> | undefined;

/** So khớp bcrypt "giả" (khi không tìm thấy tài khoản) để thời gian phản hồi tương đương nhánh thật. */
export async function simulatePasswordCheck(password: string): Promise<void> {
  dummyHash ??= hash(randomBytes(16).toString('hex'), BCRYPT_COST);
  await compare(password, await dummyHash);
}
