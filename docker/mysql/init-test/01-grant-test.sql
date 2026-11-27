-- CHỈ DÙNG CHO MySQL KIỂM THỬ (docker-compose.test.yml). Chạy MỘT LẦN khi volume mysql-test-data còn trống.
-- Cùng nguyên tắc VH-01 với docker/mysql/init/01-grant-dev.sql, nhưng tên database/user riêng cho test:
--
-- 1) 'green_test_migrate' (MYSQL_USER) = tài khoản MIGRATION, dùng qua MIGRATION_DATABASE_URL cho Prisma CLI.
--    Entrypoint đã cấp ALL trên `greenshopping_test`.* (DDL; đủ cho migrate deploy/reset).
--    Thêm quyền trên shadow database tạm `prisma_migrate_shadow_db_<uuid>` (migrate dev / migrate diff --from-migrations).
GRANT ALL PRIVILEGES ON `prisma\_migrate\_shadow\_db\_%`.* TO 'green_test_migrate'@'%';

-- 2) 'green_test_app' = tài khoản ỨNG DỤNG, dùng qua DATABASE_URL (NestJS khi chạy E2E): CHỈ DML.
CREATE USER IF NOT EXISTS 'green_test_app'@'%' IDENTIFIED BY 'green_test_app_pw';
GRANT SELECT, INSERT, UPDATE, DELETE ON `greenshopping_test`.* TO 'green_test_app'@'%';

FLUSH PRIVILEGES;
