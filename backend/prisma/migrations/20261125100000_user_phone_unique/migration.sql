-- DL-01: số điện thoại là định danh đăng nhập → thêm ràng buộc UNIQUE cho `user`.`phone`.
-- DDL ở bước 4 do `prisma migrate diff` sinh ra; bước 1–3 xử lý dữ liệu cũ để tạo UNIQUE an toàn.
-- Yêu cầu MySQL 8.0+ (window function). Các bước dữ liệu idempotent: chạy lại không đổi gì thêm.

-- 1) Chuẩn hóa khoảng trắng 2 đầu; chuỗi rỗng → NULL (UNIQUE của MySQL cho phép nhiều NULL).
--    So sánh độ dài vì collation utf8mb4_unicode_ci (PAD SPACE) coi '0912 ' = '0912'.
UPDATE `user` SET `phone` = TRIM(`phone`)
WHERE `phone` IS NOT NULL AND CHAR_LENGTH(`phone`) <> CHAR_LENGTH(TRIM(`phone`));
UPDATE `user` SET `phone` = NULL WHERE CHAR_LENGTH(`phone`) = 0;

-- 2) +84xxxxxxxxx → 0xxxxxxxxx: cùng quy tắc normalizeVnPhone() mà đăng ký/đăng nhập đang dùng.
UPDATE `user` SET `phone` = CONCAT('0', SUBSTRING(`phone`, 4)) WHERE `phone` LIKE '+84%';

-- 3) Bản ghi trùng SĐT: giữ SĐT cho tài khoản tạo sớm nhất (hòa thì user_id nhỏ hơn), các tài khoản
--    còn lại bị gỡ SĐT (phone = NULL). Ghi vết vào audit_log TRƯỚC khi gỡ để đối soát thủ công:
--    SELECT * FROM `audit_log` WHERE `action` = 'PHONE_DEDUP_MIGRATION';
INSERT INTO `audit_log` (`audit_log_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `note`)
SELECT UUID(), NULL, 'PHONE_DEDUP_MIGRATION', 'User', d.`user_id`,
       JSON_OBJECT('phone', d.`phone`),
       JSON_OBJECT('phone', NULL, 'phoneKeptByUserId', d.`keeper_id`),
       'Migration 20261125100000_user_phone_unique: SĐT trùng tài khoản khác nên đã gỡ để thêm UNIQUE. Cần liên hệ khách xác minh lại SĐT.'
FROM (
    SELECT `user_id`, `phone`,
           FIRST_VALUE(`user_id`) OVER w AS `keeper_id`,
           ROW_NUMBER() OVER w AS `rn`
    FROM `user`
    WHERE `phone` IS NOT NULL
    WINDOW w AS (PARTITION BY `phone` ORDER BY `created_at`, `user_id`)
) AS d
WHERE d.`rn` > 1;

-- Bảng dẫn xuất có window function luôn được materialize nên được phép JOIN vào chính bảng đang UPDATE.
UPDATE `user` AS u
JOIN (
    SELECT `user_id`,
           ROW_NUMBER() OVER (PARTITION BY `phone` ORDER BY `created_at`, `user_id`) AS `rn`
    FROM `user`
    WHERE `phone` IS NOT NULL
) AS d ON d.`user_id` = u.`user_id`
SET u.`phone` = NULL
WHERE d.`rn` > 1;

-- 4) Thay index thường bằng UNIQUE. Tạo UNIQUE trước rồi mới xóa index cũ: nếu bước tạo thất bại,
--    bảng vẫn còn index tra cứu theo SĐT.
-- CreateIndex
CREATE UNIQUE INDEX `user_phone_key` ON `user`(`phone`);

-- DropIndex
DROP INDEX `user_phone_idx` ON `user`;
