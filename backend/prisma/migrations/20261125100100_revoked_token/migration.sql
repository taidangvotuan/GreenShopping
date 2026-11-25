-- BM-03: lưu `jti` của access token đã bị thu hồi (logout). Sinh bằng `prisma migrate diff`.
-- CreateTable
CREATE TABLE `revoked_token` (
    `jti` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `expires_at` TIMESTAMP(0) NOT NULL,
    `revoked_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `revoked_token_user_id_idx`(`user_id`),
    INDEX `revoked_token_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`jti`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `revoked_token` ADD CONSTRAINT `revoked_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
