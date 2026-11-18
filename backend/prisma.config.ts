// Cấu hình Prisma CLI (Prisma ORM 7) — đặt ở thư mục gốc backend/
// Prisma 7 không còn đọc `url` trong schema; URL kết nối lấy từ đây.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Trỏ tới THƯ MỤC → Prisma gộp tất cả *.prisma bên trong (schema chia theo miền)
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    // `npx prisma db seed` sẽ chạy lệnh này
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
