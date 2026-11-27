/**
 * QA-01/QA-03: E2E tạo và xóa dữ liệu thật (user, đơn hàng, voucher...) → chỉ được chạy trên MySQL test
 * riêng (docker-compose.test.yml, 127.0.0.1:3308). Quy ước: tên database phải kết thúc bằng "_test".
 *
 * Được gọi trong test/setup-e2e.ts, tức là TRƯỚC khi AppModule nạp backend/.env. Vì vậy thiếu DATABASE_URL
 * cũng bị coi là lỗi: nếu cho qua, ConfigModule sẽ lấy DATABASE_URL của DB dev trong backend/.env.
 *
 * Bản dùng cho dòng lệnh trước `prisma migrate deploy`: scripts/assert-test-database.mjs (cùng quy tắc,
 * nhưng bắt buộc cả MIGRATION_DATABASE_URL). Sửa quy tắc ở một bên thì sửa cả bên kia.
 */
export const TEST_DATABASE_SUFFIX = '_test';

/** Tên database trong chuỗi kết nối `mysql://user:pass@host:port/<tên>`; null nếu không đọc được. */
export function databaseNameOf(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || null;
  } catch {
    return null;
  }
}

/**
 * Các lý do không được chạy E2E (mảng rỗng = an toàn). DATABASE_URL bắt buộc; MIGRATION_DATABASE_URL
 * không bắt buộc với Jest nhưng nếu có thì cũng phải trỏ tới DB test. Thông báo không chứa mật khẩu.
 */
export function testDatabaseProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL'] as const) {
    const value = env[key];
    if (!value) {
      if (key === 'DATABASE_URL') problems.push(`${key} chưa được đặt`);
      continue;
    }
    const name = databaseNameOf(value);
    if (!name?.endsWith(TEST_DATABASE_SUFFIX)) {
      problems.push(
        `${key} trỏ tới database "${name ?? '(không đọc được)'}", không kết thúc bằng "${TEST_DATABASE_SUFFIX}"`,
      );
    }
  }
  return problems;
}

/** Dừng ngay (ném lỗi) nếu môi trường hiện tại không trỏ tới DB test. */
export function assertTestDatabase(env: NodeJS.ProcessEnv = process.env): void {
  const problems = testDatabaseProblems(env);
  if (problems.length) {
    throw new Error(
      `Từ chối chạy E2E ngoài DB test: ${problems.join('; ')}. ` +
        'Dùng `npm run test:e2e:db` (tự dựng MySQL test + migrate) hoặc `npm run test:e2e -w backend` ' +
        'khi DB test đã chạy. Lần đầu: sao chép backend/.env.test.example thành backend/.env.test.',
    );
  }
}
