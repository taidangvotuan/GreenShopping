-- DL-02: invariant thương mại được CSDL bảo vệ ở MỌI đường ghi (không chỉ DTO/checkout).
-- Prisma schema không biểu diễn CHECK constraint → migration chỉ có SQL (cùng cách với
-- chk_green_point_account_balance_non_negative ở 20261118090000_init_auth_user). MySQL 8.0.16+ mới thực thi CHECK.
--
-- Mỗi điều kiện khớp hoặc LỎNG hơn quy tắc tầng ứng dụng nên không chặn nhầm thao tác hợp lệ:
--   - tồn kho chỉ bị trừ khi stock >= quantity (checkout.service.ts), được cộng lại khi hoàn kho;
--   - số lượng giỏ/đơn 1..99 (AddCartItemDto, UpdateCartItemDto);
--   - voucher: value >= 1, PERCENT <= 100, ends_at > starts_at (promotions.service.ts).
-- Trước khi thêm, kiểm tra dữ liệu vi phạm (phải trả 0 dòng, nếu không ALTER sẽ thất bại):
--   SELECT * FROM `product` WHERE `stock` < 0 OR `price` < 0;
--   SELECT * FROM `cart_item` WHERE `quantity` <= 0;
--   SELECT * FROM `order_item` WHERE `quantity` <= 0 OR `unit_price` < 0;
--   SELECT * FROM `promotion` WHERE (`type` = 'PERCENT' AND `value` NOT BETWEEN 0 AND 100) OR `ends_at` <= `starts_at`;

-- Tồn kho không âm, giá không âm
ALTER TABLE `product`
    ADD CONSTRAINT `chk_product_stock_non_negative` CHECK (`stock` >= 0),
    ADD CONSTRAINT `chk_product_price_non_negative` CHECK (`price` >= 0);

-- Số lượng dương
ALTER TABLE `cart_item`
    ADD CONSTRAINT `chk_cart_item_quantity_positive` CHECK (`quantity` > 0);

ALTER TABLE `order_item`
    ADD CONSTRAINT `chk_order_item_quantity_positive` CHECK (`quantity` > 0),
    ADD CONSTRAINT `chk_order_item_unit_price_non_negative` CHECK (`unit_price` >= 0);

-- Voucher: phần trăm giảm trong [0, 100]; thời hạn kết thúc sau thời điểm bắt đầu
ALTER TABLE `promotion`
    ADD CONSTRAINT `chk_promotion_percent_range` CHECK (`type` <> 'PERCENT' OR `value` BETWEEN 0 AND 100),
    ADD CONSTRAINT `chk_promotion_period` CHECK (`ends_at` > `starts_at`);
