-- NV-01: COD giao đủ chuyển sang PENDING_MANUAL_RECONCILIATION (chờ đối soát) thay vì tự SUCCEEDED.
-- Chỉ thêm giá trị mới vào cuối ENUM → dữ liệu hiện có không đổi. Sinh bằng `prisma migrate diff`.
-- AlterTable
ALTER TABLE `payment` MODIFY `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'PENDING_MANUAL_RECONCILIATION') NOT NULL;

-- AlterTable
ALTER TABLE `payment_event` MODIFY `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'PENDING_MANUAL_RECONCILIATION') NOT NULL;
