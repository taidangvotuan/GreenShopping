import { createHash } from 'node:crypto';
import { hash } from 'bcrypt';
import {
  BCRYPT_COST,
  hashLegacyPassword,
  hashPassword,
  isBcryptHash,
  verifyPassword,
} from '../../src/common/utils/password.util';

jest.setTimeout(30_000);

const PASSWORD = 'GreenShop@2026';
const LEGACY_SALT = 'legacy_salt_for_unit_test_0001';

describe('password.util — bcrypt + tương thích hash SHA-256 cũ (BM-02)', () => {
  it('hashPassword tạo bcrypt $2b$ với cost ≥ 10 và salt riêng cho từng lần băm', async () => {
    const [first, second] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);

    expect(BCRYPT_COST).toBeGreaterThanOrEqual(10);
    expect(first).toMatch(new RegExp(`^\\$2b\\$${BCRYPT_COST}\\$`));
    expect(isBcryptHash(first)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('bcrypt: đúng mật khẩu → hợp lệ, không cần nâng cấp; sai mật khẩu → không hợp lệ', async () => {
    const stored = await hashPassword(PASSWORD);

    await expect(verifyPassword(PASSWORD, stored, LEGACY_SALT)).resolves.toEqual({
      valid: true,
      needsRehash: false,
    });
    await expect(verifyPassword('WrongPass@123', stored, LEGACY_SALT)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it('bcrypt tiền tố $2a$ (thư viện khác sinh ra) vẫn xác minh bằng bcrypt.compare', async () => {
    const stored = (await hash(PASSWORD, BCRYPT_COST)).replace(/^\$2b\$/, '$2a$');

    expect(isBcryptHash(stored)).toBe(true);
    await expect(verifyPassword(PASSWORD, stored)).resolves.toEqual({
      valid: true,
      needsRehash: false,
    });
  });

  it('bcrypt cost thấp hơn BCRYPT_COST → hợp lệ nhưng cần nâng cấp', async () => {
    const stored = await hash(PASSWORD, 10);

    await expect(verifyPassword(PASSWORD, stored)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it('hash SHA-256 cũ: đúng mật khẩu → hợp lệ + cần nâng cấp; sai mật khẩu → không hợp lệ', async () => {
    const legacy = createHash('sha256')
      .update(PASSWORD + LEGACY_SALT)
      .digest('hex');

    expect(hashLegacyPassword(PASSWORD, LEGACY_SALT)).toBe(legacy);
    expect(isBcryptHash(legacy)).toBe(false);
    await expect(verifyPassword(PASSWORD, legacy, LEGACY_SALT)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
    await expect(verifyPassword('WrongPass@123', legacy, LEGACY_SALT)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it('hash cũ nhưng thiếu muối, hoặc chuỗi không đúng định dạng nào → không hợp lệ', async () => {
    const legacy = hashLegacyPassword(PASSWORD, LEGACY_SALT);

    await expect(verifyPassword(PASSWORD, legacy)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
    await expect(verifyPassword(PASSWORD, PASSWORD, LEGACY_SALT)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});
