// Chốt chặn dòng lệnh chạy TRƯỚC `prisma migrate deploy` trên MySQL test (npm run db:test:migrate -w backend).
// Gọi bằng: node --env-file=.env.test scripts/assert-test-database.mjs
//
// prisma.config.ts ưu tiên MIGRATION_DATABASE_URL, còn `import 'dotenv/config'` sẽ nạp từ backend/.env (DB dev)
// mọi biến mà backend/.env.test bỏ sót → bắt buộc CẢ HAI biến có mặt và trỏ tới database kết thúc bằng "_test".
// Cùng quy tắc với test/test-database-guard.ts (dùng cho Jest) — sửa một bên thì sửa cả bên kia.
const SUFFIX = '_test';
const problems = [];

for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) {
  const value = process.env[key];
  if (!value) {
    problems.push(`${key} chưa được đặt`);
    continue;
  }
  let name = null;
  try {
    name = decodeURIComponent(new URL(value).pathname.replace(/^\//, '')) || null;
  } catch {
    name = null;
  }
  if (!name?.endsWith(SUFFIX)) {
    problems.push(`${key} trỏ tới database "${name ?? '(không đọc được)'}", không kết thúc bằng "${SUFFIX}"`);
  }
}

if (problems.length) {
  console.error(`✘ Từ chối thao tác ngoài DB test: ${problems.join('; ')}.`);
  process.exit(1);
}
console.log('✔ DATABASE_URL và MIGRATION_DATABASE_URL đều trỏ tới DB test.');
