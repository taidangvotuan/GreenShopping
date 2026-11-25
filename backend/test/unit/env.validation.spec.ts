import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  DEFAULT_ACCESS_TOKEN_TTL,
  MIN_PRODUCTION_JWT_SECRET_LENGTH,
  validateEnv,
  weakJwtSecretReasons,
} from '../../src/common/config/env.validation';

const STRONG_SECRET = randomBytes(48).toString('hex');

const baseEnv = (overrides: Record<string, unknown> = {}) => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'mysql://green_app:pw@db.internal:3306/green_shopping',
  JWT_ACCESS_SECRET: STRONG_SECRET,
  PASSWORD_SALT: 'legacy_salt_for_unit_test_0001',
  ...overrides,
});

describe('validateEnv — JWT_ACCESS_SECRET ở production (BM-01)', () => {
  it('chấp nhận khóa ngẫu nhiên đủ dài', () => {
    expect(validateEnv(baseEnv()).JWT_ACCESS_SECRET).toBe(STRONG_SECRET);
  });

  it.each([
    ['giá trị mẫu trong backend/.env.example', 'change_me_access_secret'],
    ['ngắn hơn 32 ký tự', randomBytes(15).toString('hex')],
    ['dài nhưng là chuỗi giữ chỗ', `change_me_${randomBytes(24).toString('hex')}`],
    ['dài nhưng quá ít ký tự khác nhau', 'a'.repeat(64)],
  ])('từ chối khởi động: %s', (_label, secret) => {
    expect(() => validateEnv(baseEnv({ JWT_ACCESS_SECRET: secret }))).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('weakJwtSecretReasons liệt kê lý do, rỗng khi đạt', () => {
    expect(MIN_PRODUCTION_JWT_SECRET_LENGTH).toBeGreaterThanOrEqual(32);
    expect(weakJwtSecretReasons('change_me_access_secret').length).toBeGreaterThan(0);
    expect(weakJwtSecretReasons('SECRET'.padEnd(40, '!'))).not.toHaveLength(0);
    expect(weakJwtSecretReasons(STRONG_SECRET)).toEqual([]);
  });

  it('development vẫn khởi động với khóa mẫu nhưng ghi cảnh báo', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const env = validateEnv(
      baseEnv({ NODE_ENV: 'development', JWT_ACCESS_SECRET: 'change_me_access_secret' }),
    );

    expect(env.NODE_ENV).toBe('development');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('JWT_ACCESS_SECRET'));
    warn.mockRestore();
  });
});

describe('validateEnv — thời hạn access token (BM-03)', () => {
  it(`mặc định ${DEFAULT_ACCESS_TOKEN_TTL} (trong khoảng 15m–30m)`, () => {
    expect(validateEnv(baseEnv()).JWT_ACCESS_EXPIRES_IN).toBe('30m');
  });

  it.each(['15m', '1h', '900s'])('chấp nhận %s', (ttl) => {
    expect(validateEnv(baseEnv({ JWT_ACCESS_EXPIRES_IN: ttl })).JWT_ACCESS_EXPIRES_IN).toBe(ttl);
  });

  it.each(['7 days', '0m', 'abc', ''])('từ chối cú pháp không hợp lệ: "%s"', (ttl) => {
    expect(() => validateEnv(baseEnv({ JWT_ACCESS_EXPIRES_IN: ttl }))).toThrow(
      /JWT_ACCESS_EXPIRES_IN/,
    );
  });
});

describe('validateEnv — PAYMENT_MOCK_ENABLED (NV-01)', () => {
  it('mặc định false khi không khai báo', () => {
    expect(validateEnv(baseEnv()).PAYMENT_MOCK_ENABLED).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('"%s" → %s', (raw, expected) => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    expect(validateEnv(baseEnv({ PAYMENT_MOCK_ENABLED: raw })).PAYMENT_MOCK_ENABLED).toBe(expected);
    warn.mockRestore();
  });

  it.each(['1', 'yes', 'TRUE'])('giá trị mơ hồ "%s" bị từ chối khi khởi động', (raw) => {
    expect(() => validateEnv(baseEnv({ PAYMENT_MOCK_ENABLED: raw }))).toThrow(
      /PAYMENT_MOCK_ENABLED/,
    );
  });
});
