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
    // Biên dịch bằng tsc rồi chạy bằng node: Prisma Client sinh ra dùng import '.js' mà ts-node không phân giải được
    seed: 'npm run db:seed',
  },
  datasource: {
    // SECURITY (VH-01): Prisma CLI (migrate dev/deploy/reset) cần quyền DDL → tài khoản migration riêng.
    // Ứng dụng chạy bằng DATABASE_URL (tài khoản chỉ có DML). Thiếu biến này → dùng DATABASE_URL như cũ.
    url: process.env.MIGRATION_DATABASE_URL ?? env('DATABASE_URL'),
  },
});
