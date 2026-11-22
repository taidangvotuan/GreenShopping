-- CreateTable
CREATE TABLE `cart` (
    `cart_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,

    UNIQUE INDEX `cart_user_id_key`(`user_id`),
    PRIMARY KEY (`cart_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_item` (
    `cart_item_id` CHAR(36) NOT NULL,
    `cart_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,

    INDEX `cart_item_product_id_idx`(`product_id`),
    UNIQUE INDEX `cart_item_cart_id_product_id_key`(`cart_id`, `product_id`),
    PRIMARY KEY (`cart_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_order` (
    `master_order_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `request_id` CHAR(36) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `status` ENUM('AWAITING_PAYMENT', 'PROCESSING', 'SHIPPING', 'DELIVERY_ISSUE', 'COMPLETED', 'CANCELLED') NOT NULL,
    `recipient_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `ward` VARCHAR(100) NOT NULL,
    `address_line` VARCHAR(255) NOT NULL,
    `subtotal` DECIMAL(16, 0) NOT NULL,
    `shipping_fee` DECIMAL(16, 0) NOT NULL,
    `voucher_code` VARCHAR(32) NULL,
    `voucher_discount` DECIMAL(16, 0) NOT NULL,
    `points_used` INTEGER NOT NULL,
    `point_discount` DECIMAL(16, 0) NOT NULL,
    `grand_total` DECIMAL(16, 0) NOT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(3) NOT NULL,

    INDEX `master_order_user_id_created_at_idx`(`user_id`, `created_at`),
    UNIQUE INDEX `master_order_user_id_request_id_key`(`user_id`, `request_id`),
    PRIMARY KEY (`master_order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_order` (
    `sub_order_id` CHAR(36) NOT NULL,
    `master_order_id` CHAR(36) NOT NULL,
    `shop_id` CHAR(36) NOT NULL,
    `shop_name` VARCHAR(150) NOT NULL,
    `status` ENUM('AWAITING_PAYMENT', 'PROCESSING', 'READY', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED') NOT NULL,
    `eco_packaging` BOOLEAN NOT NULL DEFAULT false,
    `subtotal` DECIMAL(16, 0) NOT NULL,
    `shipping_fee` DECIMAL(16, 0) NOT NULL,
    `voucher_discount` DECIMAL(16, 0) NOT NULL,
    `point_discount` DECIMAL(16, 0) NOT NULL,
    `grand_total` DECIMAL(16, 0) NOT NULL,
    `updated_at` TIMESTAMP(3) NOT NULL,

    INDEX `sub_order_shop_id_status_idx`(`shop_id`, `status`),
    UNIQUE INDEX `sub_order_master_order_id_shop_id_key`(`master_order_id`, `shop_id`),
    PRIMARY KEY (`sub_order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item` (
    `order_item_id` CHAR(36) NOT NULL,
    `sub_order_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `product_name` VARCHAR(150) NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `unit_price` DECIMAL(12, 0) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `source_cart_item_id` CHAR(36) NULL,
    `source_cart_revision` INTEGER NULL,

    INDEX `order_item_sub_order_id_idx`(`sub_order_id`),
    INDEX `order_item_product_id_idx`(`product_id`),
    INDEX `order_item_source_cart_item_id_idx`(`source_cart_item_id`),
    PRIMARY KEY (`order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment` (
    `payment_id` CHAR(36) NOT NULL,
    `master_order_id` CHAR(36) NOT NULL,
    `method` ENUM('COD', 'MOCK') NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL,
    `amount` DECIMAL(16, 0) NOT NULL,
    `expires_at` TIMESTAMP(3) NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` TIMESTAMP(3) NULL,

    UNIQUE INDEX `payment_master_order_id_key`(`master_order_id`),
    INDEX `payment_status_expires_at_idx`(`status`, `expires_at`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_event` (
    `payment_event_id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_id` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_event_payment_id_payment_event_id_idx`(`payment_id`, `payment_event_id`),
    PRIMARY KEY (`payment_event_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promotion` (
    `promotion_id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('FIXED', 'PERCENT') NOT NULL,
    `value` DECIMAL(12, 0) NOT NULL,
    `min_subtotal` DECIMAL(16, 0) NOT NULL DEFAULT 0,
    `max_discount` DECIMAL(12, 0) NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `promotion_code_key`(`code`),
    INDEX `promotion_active_starts_at_ends_at_idx`(`active`, `starts_at`, `ends_at`),
    PRIMARY KEY (`promotion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment` (
    `shipment_id` CHAR(36) NOT NULL,
    `sub_order_id` CHAR(36) NOT NULL,
    `tracking_code` VARCHAR(40) NOT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shipment_sub_order_id_key`(`sub_order_id`),
    UNIQUE INDEX `shipment_tracking_code_key`(`tracking_code`),
    PRIMARY KEY (`shipment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_event` (
    `order_status_event_id` INTEGER NOT NULL AUTO_INCREMENT,
    `sub_order_id` CHAR(36) NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `status` ENUM('AWAITING_PAYMENT', 'PROCESSING', 'READY', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED') NOT NULL,
    `note` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_status_event_sub_order_id_order_status_event_id_idx`(`sub_order_id`, `order_status_event_id`),
    INDEX `order_status_event_actor_user_id_idx`(`actor_user_id`),
    PRIMARY KEY (`order_status_event_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shop` (
    `shop_id` CHAR(36) NOT NULL,
    `owner_user_id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `shipping_fee` DECIMAL(12, 0) NOT NULL DEFAULT 0,

    INDEX `shop_owner_user_id_idx`(`owner_user_id`),
    PRIMARY KEY (`shop_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product` (
    `product_id` CHAR(36) NOT NULL,
    `shop_id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `image_gallery` JSON NULL,
    `price` DECIMAL(12, 0) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `product_shop_id_idx`(`shop_id`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cart` ADD CONSTRAINT `cart_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_cart_id_fkey` FOREIGN KEY (`cart_id`) REFERENCES `cart`(`cart_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_order` ADD CONSTRAINT `master_order_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_order` ADD CONSTRAINT `sub_order_master_order_id_fkey` FOREIGN KEY (`master_order_id`) REFERENCES `master_order`(`master_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_order` ADD CONSTRAINT `sub_order_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shop`(`shop_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_sub_order_id_fkey` FOREIGN KEY (`sub_order_id`) REFERENCES `sub_order`(`sub_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_master_order_id_fkey` FOREIGN KEY (`master_order_id`) REFERENCES `master_order`(`master_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_event` ADD CONSTRAINT `payment_event_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payment`(`payment_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipment` ADD CONSTRAINT `shipment_sub_order_id_fkey` FOREIGN KEY (`sub_order_id`) REFERENCES `sub_order`(`sub_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_event` ADD CONSTRAINT `order_status_event_sub_order_id_fkey` FOREIGN KEY (`sub_order_id`) REFERENCES `sub_order`(`sub_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_event` ADD CONSTRAINT `order_status_event_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shop` ADD CONSTRAINT `shop_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shop`(`shop_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
