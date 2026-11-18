-- CHỈ DÙNG CHO MÔI TRƯỜNG PHÁT TRIỂN.
-- `prisma migrate dev` cần tạo/xóa một "shadow database" tạm để so sánh schema,
-- nên user ứng dụng phải có quyền CREATE/DROP DATABASE. Mặc định MYSQL_USER
-- chỉ có quyền trên đúng database green_shopping → migrate dev sẽ báo lỗi P3014.
GRANT ALL PRIVILEGES ON *.* TO 'green'@'%';
FLUSH PRIVILEGES;
