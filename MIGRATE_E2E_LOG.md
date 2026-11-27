# MIGRATE_E2E_LOG — MySQL test độc lập, migration DL-01/02/03 và E2E

| Mục | Giá trị |
|---|---|
| Ngày | 25/11/2026 |
| Nhánh | `chore/migrate-e2e-test-db` (tạo từ `fix/p0-audit` @ `ac94318`). **Chưa commit, chưa push** |
| DB test | `greenshopping_test` @ `127.0.0.1:3308`, container `green-shopping-mysql-test`, MySQL 8.4.13 |
| DB dev (không đụng tới) | `green_shopping` @ `127.0.0.1:3307`, container `green-shopping-mysql` |
| Kết quả | 6/6 migration `Applied` · E2E **3/3 suite, 53/53 test PASS** · dev không thay đổi |

## 0. Điểm dừng & quyết định trong quá trình chạy

| Thời điểm | Điều kiện | Quyết định của người dùng |
|---|---|---|
| Trước Bước 1 | `git status` có `?? .vscode/` (cấu hình IDE, không bị ignore) | Bỏ qua, chạy tiếp. Không đụng tới `.vscode/` |
| Trước Bước 1 | Cổng test `127.0.0.1:3307` trong yêu cầu **chính là MySQL dev** (`docker-compose.yml:26`, đổi từ đợt VH-01); `3306` là `mysqld.exe` cài trên Windows (PID 5288) | Dùng **`127.0.0.1:3308`** cho test |
| Bước 3.1 | Prisma 7 chặn `prisma migrate reset --force` khi agent gọi, đòi người dùng đồng ý tường minh | **Bỏ qua reset**: DB test vừa dựng từ migration, đã kiểm 21/21 bảng = 0 dòng |

Mọi lệnh Prisma chạy qua một wrapper (scratchpad, không thuộc repo). Wrapper nạp `backend/.env.test` và **từ chối (exit 97)** nếu `DATABASE_URL` hoặc `MIGRATION_DATABASE_URL` không kết thúc bằng `@127.0.0.1:3308/greenshopping_test`. Cần chặn cả hai biến vì `prisma.config.ts` ưu tiên `MIGRATION_DATABASE_URL`, còn `dotenv` có thể nạp `backend/.env` (dev). Mỗi lệnh đều in `Datasource "db": MySQL database "greenshopping_test" at "127.0.0.1:3308"`.

## 1. Trạng thái migrations (DB test)

| Thứ tự | Tên migration | Mã audit | Trạng thái apply | Thời gian (UTC) | Ghi chú SQL & rollback |
|---|---|---|---|---|---|
| 1 | `20261118090000_init_auth_user` | — | ✅ Applied | 14:40:30 | Chạy bằng `db execute` + `migrate resolve --applied` (baseline, nên `applied_steps_count = 0`). Bước 2.1 yêu cầu chỉ đưa DB lên tới `commerce_checkout`, và `migrate deploy` không dừng giữa chừng được |
| 2 | `20261122022500_commerce_checkout` | — | ✅ Applied | 14:40:41 | Như trên |
| 3 | `20261125100000_user_phone_unique` | **DL-01** | ✅ Applied | 14:43:31 | **Đã có sẵn** từ đợt P0 → review, không tạo trùng. Gồm: trim, rỗng → NULL, `+84` → `0`, khử trùng có ghi `audit_log`, `UNIQUE user_phone_key`. Đã thử trên DB `dl01_probe` với 7 bản ghi trùng/rỗng: đúng kỳ vọng. Rollback: DDL đảo ngược được, nhưng **chuẩn hóa/khử trùng dữ liệu không đảo ngược được** (giá trị cũ nằm trong `audit_log`) |
| 4 | `20261125100100_revoked_token` | BM-03 | ✅ Applied | 14:43:31 | Rollback: `DROP FOREIGN KEY` + `DROP TABLE` (mất danh sách token đã thu hồi) |
| 5 | `20261125100200_payment_cod_manual_reconciliation` | NV-01 | ✅ Applied | 14:43:31 | Rollback: `MODIFY ENUM` bỏ giá trị mới, **sẽ lỗi nếu còn dòng `PENDING_MANUAL_RECONCILIATION`** → phải cập nhật dữ liệu trước |
| 6 | `20261125120000_commerce_check_constraints` *(mới)* | **DL-02** | ✅ Applied | 14:43:31 | 7 CHECK (xem dưới). Dữ liệu vi phạm trước khi thêm: 0. Đã chứng minh MySQL thực thi: insert PERCENT 150 và `ends_at = starts_at` đều bị lỗi `3819`. Rollback: `DROP CHECK` (viết tay vì CHECK nằm ngoài Prisma schema) |
| — | *(không tạo)* | **DL-03** | ⏭️ Không áp dụng | — | Xem phân tích dưới |

**CHECK của DL-02.** Tên cột thực tế đã đối chiếu với schema: không có `discount_percent`, `start_date`, `end_date`; dùng `promotion.type/value`, `starts_at/ends_at`.
- `product`: `stock >= 0`, `price >= 0`
- `cart_item`: `quantity > 0`
- `order_item`: `quantity > 0`, `unit_price >= 0`
- `promotion`: `type <> 'PERCENT' OR value BETWEEN 0 AND 100`, `ends_at > starts_at` (chặt, khớp `promotions.service.ts`, vốn từ chối `endsAt <= startsAt`)

Mỗi điều kiện đều khớp hoặc lỏng hơn quy tắc tầng ứng dụng, nên không chặn nhầm thao tác hợp lệ.

**DL-03 — vì sao không tạo migration.** Model `Address` **đã có** `province`, `ward` (`VARCHAR(100) NOT NULL`, từ `init_auth_user`). Audit nêu khiếm khuyết ở **luồng đăng ký** (`auth.service.ts` ghi `province = ''`, `ward = ''`), tức là logic nghiệp vụ, nằm ngoài ranh giới đợt này. Hai phương án migration đã cân nhắc và loại:
- *Chuyển sang nullable, `''` → NULL*: đổi kiểu Prisma thành `string | null`, buộc sửa code checkout/FE. Vi phạm ranh giới.
- *Backfill bằng cách tách chuỗi `address_line`*: chuỗi tự do không có cấu trúc, tách theo heuristic dễ sai tỉnh/phường, nên làm hỏng dữ liệu.

`NOT NULL DEFAULT ''` hiện tại không làm gãy dữ liệu cũ hay E2E (checkout E2E luôn gửi đủ `province`/`ward`). Chuyển cho Prompt A.

**Xác minh.**
- `prisma migrate status` → `6 migrations found … Database schema is up to date!` (exit 0).
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` → `This is an empty migration.` (không drift).
- `--from-migrations` (Prisma 7) báo cần `datasource.shadowDatabaseUrl` trong `prisma.config.ts`. Không sửa config, vì DB test được dựng thuần từ chuỗi migration và diff ở trên đã rỗng → bằng chứng tương đương.
- `prisma generate` exit 0. Checksum 5 migration chung trùng khớp test ↔ dev.

**Rollback.** Prisma **không có** `migrate rollback`. Cờ `--from-schema-datamodel`/`--to-migrations` trong yêu cầu không tồn tại ở Prisma 7: thay bằng `--from-schema`, và `--to-migrations` cần shadow DB. Script revert đã được **chạy thật** trên `greenshopping_test`. Kết quả: diff DB → schema trước đợt vá **rỗng**, chỉ còn CHECK gốc. Sau đó roll-forward (`migrate deploy`) áp lại cả 4 migration thành công.

```sql
-- REVERT DL-02 (viết tay)
ALTER TABLE `promotion` DROP CHECK `chk_promotion_period`, DROP CHECK `chk_promotion_percent_range`;
ALTER TABLE `order_item` DROP CHECK `chk_order_item_unit_price_non_negative`, DROP CHECK `chk_order_item_quantity_positive`;
ALTER TABLE `cart_item` DROP CHECK `chk_cart_item_quantity_positive`;
ALTER TABLE `product` DROP CHECK `chk_product_price_non_negative`, DROP CHECK `chk_product_stock_non_negative`;
-- REVERT NV-01, BM-03, DL-01 (prisma migrate diff --from-schema prisma/schema --to-schema <schema @ 9c1256c> --script)
ALTER TABLE `revoked_token` DROP FOREIGN KEY `revoked_token_user_id_fkey`;
DROP INDEX `user_phone_key` ON `user`;
ALTER TABLE `payment` MODIFY `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL;
ALTER TABLE `payment_event` MODIFY `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL;
DROP TABLE `revoked_token`;
CREATE INDEX `user_phone_idx` ON `user`(`phone`);
-- Gỡ lịch sử để migrate deploy áp lại được
DELETE FROM `_prisma_migrations` WHERE `migration_name` IN ('20261125120000_commerce_check_constraints',
  '20261125100200_payment_cod_manual_reconciliation','20261125100100_revoked_token','20261125100000_user_phone_unique');
```

## 2. Kết quả E2E (MySQL test thật)

Lệnh (trong `backend/`): `node --env-file=.env.test --experimental-vm-modules ../node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand` → **exit 0**, khoảng 49 giây. Đã kiểm trước khi chạy: `DATABASE_URL → green_test_app@127.0.0.1:3308/greenshopping_test`, `NODE_ENV=test`. Không cần seed vì các suite tự upsert role/fixture. Sau khi chạy: 0 user còn lại, 4 role.

| File spec | Tổng | Pass | Fail | Đối chiếu audit |
|---|---|---|---|---|
| `test/app.e2e-spec.ts` | 2 | 2 | 0 | **QA-01** (`:10-23`): kỳ vọng envelope `{ success: true, statusCode, message, data: 'Hello World!', timestamp }` thay cho `'Hello World!'` → khớp interceptor. Ca 404 trả envelope lỗi |
| `test/e2e/auth.e2e-spec.ts` | 45 | 45 | 0 | **QA-03** (`:187-205` → hồi quy BM-06: `role` = ADMIN/STAFF/SELLER/CUSTOMER/admin → 400, không tạo user; `:242-253` → SQLi có khoảng trắng 400, không khoảng trắng 401). Kèm DL-01 (2 đăng ký đồng thời cùng SĐT → 201 + 409 đúng trường), BM-02 (hash cũ đăng nhập + nâng cấp), BM-03 (logout thu hồi), `PATCH /users/:id/roles` |
| `test/e2e/checkout-flow.e2e-spec.ts` | 6 | 6 | 0 | **QA-03** (`:218-221`, `:245-248`): SELLER → **403**, CUSTOMER khác → **404**; đơn chưa thanh toán không giao được; NV-01: COD giao đủ → `PENDING_MANUAL_RECONCILIATION`. Các CHECK của DL-02 không chặn luồng checkout/hoàn kho nào |
| **Tổng** | **53** | **53** | **0** | Không có test lệch kỳ vọng. Không sửa file `.e2e-spec.ts` nào |

## 3. File đã tạo / cập nhật

| File | Tóm tắt |
|---|---|
| `docker-compose.test.yml` *(mới)* | MySQL 8.4 test: project `greenshopping-test`, `127.0.0.1:3308`, volume `mysql-test-data`, DB `greenshopping_test`, healthcheck `mysqladmin ping` |
| `docker/mysql/init-test/01-grant-test.sql` *(mới)* | VH-01 cho test: `green_test_migrate` (DDL + shadow DB), `green_test_app` (chỉ DML) |
| `backend/.env.test.example` *(mới)* | URL app/migration trỏ `127.0.0.1:3308/greenshopping_test` + biến tối thiểu để boot `NODE_ENV=test` |
| `backend/prisma/migrations/20261125120000_commerce_check_constraints/migration.sql` *(mới)* | DL-02: 7 CHECK constraint |
| `.gitignore` | Thêm `!.env.test.example`; nếu thiếu, quy tắc `.env.*` sẽ ignore file mẫu mới |
| `MIGRATE_E2E_LOG.md` *(mới)* | Báo cáo này |

Ngoài Git: `backend/.env.test` (bản sao cục bộ, bị ignore), `backend/src/generated/prisma` (sinh lại, bị ignore). Prisma schema không đổi (DL-01 đã có `@unique` từ trước; DL-02 không biểu diễn được trong schema; DL-03 không áp dụng).

## 4. Vấn đề còn mở & đề xuất

| # | Vấn đề | Đề xuất |
|---|---|---|
| 1 | **DL-03**: đăng ký ghi `province`/`ward` rỗng | **Prompt A**: thu địa chỉ có cấu trúc ở form/DTO đăng ký, hoặc không tạo địa chỉ mặc định cho tới khi checkout có đủ trường |
| 2 | DL-01: migration chỉ trim 2 đầu, không bỏ khoảng trắng **giữa** số (`091 234 5678`); tên index là `user_phone_key` (Prisma) thay vì `uq_user_phone` | Không sửa migration đã apply trên dev (sẽ lệch checksum). DTO đã cấm khoảng trắng. Nếu cần, viết migration mới. Đổi tên index phải kèm `@unique(map: "uq_user_phone")` |
| 3 | `migrate diff --from-migrations` cần `shadowDatabaseUrl` (Prisma 7) | Thêm `shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL` (tùy chọn) vào `prisma.config.ts` để chạy kiểm tra drift trong CI |
| 4 | Agent không được tự chạy `migrate reset` | Chạy thủ công khi cần làm sạch: `cd backend && node --env-file=.env.test ../node_modules/prisma/build/index.js migrate reset --force`, hoặc `docker compose -f docker-compose.test.yml down -v` rồi `up -d --wait` và `migrate deploy` |
| 5 | Chưa có script npm cho luồng E2E trên DB test | Cân nhắc thêm `test:e2e:db` (dựng compose test → `migrate deploy` → jest với `--env-file=.env.test`) và job CI tương ứng |
| 6 | Rollback NV-01 lỗi nếu còn dòng `PENDING_MANUAL_RECONCILIATION`; dữ liệu DL-01 không đảo ngược được | Ghi vào runbook triển khai |
| 7 | Container phpMyAdmin dev publish `8081` trong khi `docker-compose.yml` ghi `8080` | Kiểm tra lại cách dựng container dev (biến/override) |

## 5. Bằng chứng cách ly DB dev

| | Dev | Test |
|---|---|---|
| Container | `green-shopping-mysql` (project `greenshopping`) | `green-shopping-mysql-test` (project `greenshopping-test`) |
| Cổng | `127.0.0.1:3307 → 3306` | `127.0.0.1:3308 → 3306` |
| Volume | `greenshopping_mysql_data` | `greenshopping-test_mysql-test-data` |
| Database | `green_shopping` | `greenshopping_test` |
| Cổng 3306 | `mysqld.exe` cài sẵn trên Windows, không lệnh nào chạm tới | — |

Snapshot dev được chụp **trước** khi tạo nhánh và **sau** khi chạy E2E, bằng truy vấn chỉ đọc qua `docker exec` (**không** chạy lệnh Prisma nào vào dev, đúng ràng buộc 1). `diff` hai snapshot cho kết quả **giống hệt**:
- `_prisma_migrations`: 5 dòng, cùng `finished_at`, không có `rolled_back_at`
- 22 bảng
- 6 user
- checksum cấu trúc cột `6ee1a82e13a4736361ba0c1b365359d6`
- danh sách database không đổi (không có DB test hay shadow nào xuất hiện trên dev)
