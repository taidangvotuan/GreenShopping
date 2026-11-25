-- CHỈ DÙNG CHO MÔI TRƯỜNG PHÁT TRIỂN. Chạy MỘT LẦN khi volume MySQL còn trống
-- (volume cũ: `docker compose down -v` rồi `docker compose up -d` để áp dụng lại).
--
-- SECURITY (VH-01) — tách tài khoản theo nguyên tắc quyền tối thiểu, thay cho GRANT ALL ON *.* trước đây:
--
-- 1) 'green' (MYSQL_USER) = tài khoản MIGRATION, dùng qua MIGRATION_DATABASE_URL cho Prisma CLI.
--    Entrypoint của image đã cấp ALL trên `green_shopping`.* (DDL: CREATE/ALTER/DROP/INDEX...).
--    `prisma migrate dev` còn tạo/xóa shadow database tạm tên `prisma_migrate_shadow_db_<uuid>`
--    → chỉ cấp quyền trên đúng mẫu tên đó (không cần quyền toàn cục *.* nữa).
--    Ghi chú: ký tự đại diện trong tên database của GRANT bị đánh dấu deprecated từ MySQL 8.2 nhưng vẫn
--    hoạt động trên 8.4 (partial_revokes=OFF mặc định). Thay thế lâu dài: shadowDatabaseUrl cố định.
GRANT ALL PRIVILEGES ON `prisma\_migrate\_shadow\_db\_%`.* TO 'green'@'%';

-- 2) 'green_app' (APP_DB_USER) = tài khoản ỨNG DỤNG, dùng qua DATABASE_URL (NestJS runtime, seed, E2E):
--    CHỈ có quyền DML trên `green_shopping`.* — không tạo/sửa/xóa được bảng, không đọc được DB khác.
CREATE USER IF NOT EXISTS 'green_app'@'%' IDENTIFIED BY 'green_app_dev_pw';
GRANT SELECT, INSERT, UPDATE, DELETE ON `green_shopping`.* TO 'green_app'@'%';

FLUSH PRIVILEGES;
