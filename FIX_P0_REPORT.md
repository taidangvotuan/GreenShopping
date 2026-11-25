# Báo cáo nghiệm thu P0 — GreenShopping

| Mục | Giá trị |
|---|---|
| Nhánh | `fix/p0-audit` (tạo từ `main` @ `9c1256c`, working tree sạch lúc bắt đầu) |
| Nguồn audit | `PROJECT_AUDIT_REPORT.md` — chỉ có trên `origin/voyager` (commit `f239bab`, chỉ thêm đúng file này; phần code trùng `main` @ `9c1256c`). Đọc qua `git show`, không checkout nhánh đó |
| Ngày | 25/11/2026 |
| Git | **Chưa commit, chưa push.** Toàn bộ thay đổi nằm ở working tree (chưa stage) để review |
| Môi trường kiểm thử | Node 24.17, Windows. **Docker daemon tắt, MySQL `localhost:3307` không truy cập được** |

---

## 1. Tổng quan trạng thái 3 hạng mục

| Hạng mục | Trạng thái | Xác minh | Lý do / ghi chú |
|---|---|---|---|
| **Việc 1 — BM-06** Chặn leo thang đặc quyền khi đăng ký | ✅ ĐÃ SỬA | Unit ✅ · E2E ⚠️ CHƯA XÁC MINH RUNTIME | Server luôn gán `CUSTOMER`; DTO không còn `role` (gửi kèm → 400); FE gỡ bộ chọn vai trò; thêm `PATCH /api/users/:id/roles` (chỉ ADMIN, audit log có cấu trúc). E2E hồi quy đã viết nhưng chưa chạy được vì không có MySQL |
| **Việc 2 — BM-01..04, VH-01, NV-01** Khóa cấu hình, mật khẩu, phiên, hạ tầng dev | ⚠️ SỬA MỘT PHẦN | Unit ✅ · E2E ⚠️ CHƯA XÁC MINH RUNTIME | BM-01, BM-02, BM-04, NV-01 sửa đủ. **BM-03**: đã có TTL 30m, `jti`, thu hồi khi logout, quyền đổi có hiệu lực ngay — phần chuyển sang cookie `HttpOnly` + CSRF tách thành hạng mục riêng (mục 8) đúng như yêu cầu cho phép. **VH-01**: đã bind loopback + tách tài khoản migration/ứng dụng; TLS khi kết nối DB từ xa chưa làm (ngoài chỉ dẫn 2e) |
| **Việc 3 — QA-01, QA-03, DL-01** Khôi phục test & UNIQUE cho SĐT | ✅ ĐÃ SỬA | Unit ✅ · Smoke E2E ✅ · E2E nghiệp vụ ⚠️ CHƯA XÁC MINH RUNTIME | Suite rỗng được thay bằng test thật; script `test:unit/test:e2e/test:all`; sửa kỳ vọng 400/401 và 403/404. DL-01: schema `@unique`, migration có xử lý dữ liệu, `findUnique`, 409 đúng trường. **Migration đã tạo nhưng CHƯA apply vào DB** |

---

## 2. Kết quả kiểm thử & Lint/Typecheck

### 2.1 Lệnh nghiệm thu (chạy sau khi sửa)

| Lệnh | Exit code | Kết quả |
|---|---|---|
| `npm run lint` (root) | **0** | 0 lỗi. 85 cảnh báo — **tất cả** là `unicorn(no-empty-file)` của các file 0 byte có sẵn ngoài phạm vi; không có cảnh báo nào khác. Số file `.ts` 0 byte trong `backend/src` + `backend/test`: 92 ở `HEAD` → 85 (đã điền/xóa 7 file rỗng) |
| `npm run typecheck` (root) | **1** | `Missing script: "typecheck"` → chạy ở từng workspace theo chỉ dẫn ↓ |
| `npm run typecheck -w frontend` | **0** | `tsc --noEmit` sạch |
| `npx tsc --noEmit -p tsconfig.json` (backend, không có script `typecheck`) | **0** | Sạch, gồm cả `src/`, `test/`, `prisma/seed.ts` (`tsconfig.seed.json` cũng exit 0) |
| `npm run test:all` (root → backend `test:unit && test:e2e`) | **1** | Unit **12/12 suite, 106/106 test PASS**. E2E: `app.e2e-spec.ts` **2/2 PASS** (không cần DB); `auth.e2e-spec.ts` + `checkout-flow.e2e-spec.ts` **51 test FAIL — 100% do không kết nối được MySQL**: `PrismaClientKnownRequestError: pool failed to retrieve a connection from pool` (code 45028) ngay ở `beforeAll`; các dòng `TypeError … 'access_token'` đi kèm là hệ quả (login trả 500 vì DB). **0 assertion thất bại** → ⚠️ CHƯA XÁC MINH RUNTIME |
| `npx prisma validate` / `npx prisma generate` / `npx prisma format --check` | **0 / 0 / 0** | Schema hợp lệ, client đã sinh lại (7.10.1), định dạng chuẩn |
| `npx prisma migrate dev --create-only` | **1** | `P1001: Can't reach database server at localhost:3307` → dùng phương án dự phòng (mục 6) |

**Baseline trước khi sửa** (`npm test -w backend`): exit 1 — `5 failed, 1 passed` (5 suite 0 byte: *"Your test suite must contain at least one test"*). Lint exit 0, typecheck BE/FE exit 0.

### 2.2 Unit test theo domain (không cần DB)

| Domain | Suite | Test |
|---|---|---|
| auth | `password.util.spec.ts` · `auth.service.spec.ts` · `jwt.strategy.spec.ts` · `users.service.spec.ts` · `env.validation.spec.ts` | 6 · 17 · 7 · 5 · 21 |
| cart | `cart.service.spec.ts` | 11 |
| checkout | `order-split.service.spec.ts` · `checkout.service.spec.ts` | 5 · 3 |
| payment | `payments.service.spec.ts` | 11 |
| shipment | `sub-order.fsm.spec.ts` · `shipments.service.spec.ts` | 15 · 4 |
| (có sẵn) | `src/app.controller.spec.ts` | 1 |
| **Tổng** | **12 suite** | **106 — tất cả PASS** |

### 2.3 E2E đã viết/cập nhật (cần MySQL để chạy)

- `auth.e2e-spec.ts`: gửi `role` = ADMIN/STAFF/SELLER/CUSTOMER/admin → **400** + không tạo user; đăng ký công khai → DB chỉ có `CUSTOMER`; **2 đăng ký đồng thời cùng SĐT → đúng một 201 + một 409 "Số điện thoại đã được sử dụng"**; login SQLi có khoảng trắng → **400**, không khoảng trắng → **401**; TTL/`jti` theo cấu hình; tài khoản hash SHA-256 cũ đăng nhập được và được nâng cấp bcrypt; `PATCH /users/:id/roles` (401/403/200/400/404, quyền đổi có hiệu lực ngay với token cũ, audit `ROLE_CHANGE`); logout → token bị thu hồi (401), đăng nhập lại dùng được.
- `checkout-flow.e2e-spec.ts`: SELLER gọi API của CUSTOMER → **403**, CUSTOMER khác xem/trả kết quả đơn không phải của mình → **404**; đơn online chưa thanh toán không thể chuyển mốc giao (404); COD giao đủ → `PENDING_MANUAL_RECONCILIATION`, `resolvedAt = null`.

---

## 3. Đối soát Audit IDs

| ID | Mức (audit) | Trạng thái | Đã làm | Tồn đọng |
|---|---|---|---|---|
| **BM-06** | CRITICAL | ✅ Đóng (mã nguồn) | Role cố định `PUBLIC_REGISTRATION_ROLE`; `RegisterDto` bỏ `role`; FE bỏ bộ chọn; endpoint ADMIN `PATCH /api/users/:id/roles` (khóa dòng, chặn tự đổi quyền, `audit_log` `ROLE_CHANGE` + log JSON `actorId/targetUserId/oldRole/newRole/timestamp`); roles đọc lại từ DB mỗi request | Chạy SQL rà soát (mục 7.2) trên mọi môi trường từng mở cho người ngoài; UI quản trị gán vai trò (`assign-role-dialog.tsx` đang 0 byte) |
| **BM-01** | CRITICAL có điều kiện | ✅ Đóng | `NODE_ENV=production` từ chối khởi động nếu `JWT_ACCESS_SECRET` < 32 ký tự / thuộc danh sách đen (gồm giá trị `.env.example`) / chuỗi giữ chỗ / < 10 ký tự khác nhau; dev chỉ cảnh báo; `.env.example` có cảnh báo rõ | Xoay khóa nếu môi trường công khai từng dùng khóa mẫu; bảo đảm môi trường triển khai đặt `NODE_ENV=production` |
| **BM-02** | HIGH | ✅ Đóng | bcrypt cost 12 (salt riêng, định dạng tự mô tả); verify `$2a$/$2b$/$2y$`; hash SHA-256 cũ vẫn đăng nhập được và **tự rehash** trong luồng login (ghi có điều kiện theo hash cũ); so khớp giả để chống dò thời gian | Tài khoản không bao giờ đăng nhập lại vẫn giữ hash cũ → đặt hạn buộc đổi mật khẩu rồi bỏ `PASSWORD_SALT`; bcrypt chỉ dùng 72 byte đầu |
| **BM-03** | HIGH | ⚠️ Một phần | TTL mặc định `30m` (kiểm cú pháp); `jti` UUID; logout ghi `revoked_token` + JwtStrategy từ chối; token cũ không có `jti` bị từ chối (vô hiệu toàn bộ phiên cũ khi deploy); đổi quyền có hiệu lực ngay; FE hạ max-age dự phòng 7 ngày → 30 phút | **PR riêng**: cookie `HttpOnly/Secure` do backend phát hành + CSRF + refresh token (mục 8) |
| **BM-04** | HIGH | ✅ Đóng | Seed chặn `NODE_ENV=production` ngay đầu `main()`; lõi (role/permission) luôn chạy; demo chỉ khi `SEED_DEMO=true`; không in mật khẩu; tài khoản mẫu đã có **không bị đặt lại** mật khẩu/ACTIVE/vai trò | Production cần quy trình riêng để khởi tạo role/permission (seed bị chặn ở production) |
| **VH-01** | HIGH | ✅ Đóng (phạm vi dev) | MySQL/phpMyAdmin bind `127.0.0.1`; bỏ `GRANT ALL ON *.*`; `green` = migration (DDL trên `green_shopping` + shadow DB theo mẫu tên); `green_app` = ứng dụng (chỉ DML); Prisma CLI dùng `MIGRATION_DATABASE_URL` | TLS có kiểm tra chứng chỉ khi DB ở xa (`prisma.service.ts` vẫn `allowPublicKeyRetrieval`); volume cũ cần áp lại quyền (mục 7.6) |
| **NV-01** | HIGH | ✅ Đóng | `PAYMENT_MOCK_ENABLED` (mặc định `false`): `mock-result` → 404, checkout `MOCK` → 403; COD giao đủ → `PENDING_MANUAL_RECONCILIATION` (enum + migration), không `SUCCEEDED`, không `resolvedAt`; FE hiển thị "Chờ đối soát" | Luồng đối soát COD (ADMIN chuyển trạng thái có audit); FE ẩn lựa chọn mock khi cờ tắt; rà các COD đã bị logic cũ tự `SUCCEEDED` (mục 7.5) |
| **QA-01** | HIGH | ✅ Đóng | 5 suite rỗng → test thật (3 điền, 2 thay bằng suite mới); xóa E2E rỗng `green-moderation`; smoke test dùng `setupApp` + envelope; `test:unit/test:e2e/test:all`, `npm test` = all | — |
| **QA-03** | HIGH | ✅ Đóng (mã nguồn) | Tách 400 (DTO) / 401 (sai thông tin); tách 403 (sai vai trò) / 404 (sai chủ sở hữu); thêm ca hồi quy tự cấp quyền và ca thanh toán trước giao | ⚠️ Chạy E2E trên MySQL để xác minh runtime |
| **DL-01** | HIGH | ✅ Đóng (mã nguồn + migration) | `phone @unique`; migration chuẩn hóa (trim, rỗng → NULL, `+84` → `0`), khử trùng có ghi vết `audit_log`; login `findUnique`; P2002 → 409 đúng trường | ⚠️ Migration **chưa apply**; chạy SQL kiểm tra trùng trước khi migrate (mục 7.3) |

Ngoài phạm vi đợt này (có trong cùng dòng P0 của lộ trình audit nhưng không nằm trong yêu cầu): **NV-02**, **NV-03**. Không đụng: BM-05, BM-07, KT/CL/API/HP/X.

---

## 4. Danh sách file đã thay đổi

| Đường dẫn file | Hạng mục | Tóm tắt thay đổi |
|---|---|---|
| `backend/src/modules/auth-user/auth/auth.constants.ts` | V1 · BM-06 | Bỏ `REGISTERABLE_ROLES`; thêm `PUBLIC_REGISTRATION_ROLE = 'CUSTOMER'` và `AUDIT_ACTION.ROLE_CHANGE` |
| `backend/src/modules/auth-user/auth/dto/register.dto.ts` | V1 · BM-06 | Xóa trường `role` → gửi kèm `role` bị 400 (`forbidNonWhitelisted`) |
| `backend/src/modules/auth-user/auth/auth.controller.ts` | V1 · BM-06, V2 · BM-03 | Swagger register ghi rõ luôn CUSTOMER; logout truyền `AuthenticatedUser` (có `jti`) |
| `backend/src/modules/auth-user/users/dto/assign-role.dto.ts` | V1 · BM-06 | Điền file 0 byte: DTO `role ∈ ROLE_NAMES` (trim + uppercase) |
| `backend/src/modules/auth-user/users/users.controller.ts` | V1 · BM-06 | Thêm `PATCH /users/:id/roles` với `@Roles('ADMIN')` (JwtAuthGuard toàn cục) |
| `backend/src/modules/auth-user/users/users.service.ts` | V1 · BM-06 | `assignRole()`: transaction khóa dòng, chặn tự đổi quyền, audit `ROLE_CHANGE` + log JSON |
| `frontend/src/features/auth-user/components/register-form.tsx` | V1 · BM-06 | Gỡ fieldset chọn vai trò và giá trị mặc định `role` |
| `frontend/src/features/auth-user/schemas.ts` | V1 · BM-06 | Gỡ `REGISTERABLE_ROLES`, `ROLE_OPTIONS`, trường `role` khỏi `registerSchema` |
| `frontend/src/features/auth-user/types.ts` | V1 · BM-06 | `RegisterPayload` không còn `role` |
| `backend/.env.example` | V2 · BM-01/03/04, VH-01, NV-01 | Cảnh báo khóa mẫu, TTL 30m, `DATABASE_URL` (DML) + `MIGRATION_DATABASE_URL` (DDL), `PAYMENT_MOCK_ENABLED=false`, `SEED_DEMO=false` |
| `backend/src/common/config/env.validation.ts` | V2 · BM-01/03, NV-01 | Từ chối JWT secret yếu ở production; TTL mặc định 30m có kiểm cú pháp; cờ mock boolean mặc định false |
| `backend/src/common/utils/password.util.ts` | V2 · BM-02 | bcrypt cost 12; verify `$2a/$2b/$2y`; xác minh SHA-256 cũ + `needsRehash`; so khớp giả |
| `backend/src/modules/auth-user/auth/auth.service.ts` | V1 · BM-06, V2 · BM-02/03, V3 · DL-01 | Role cố định; bcrypt + auto-rehash; `jti`; logout ghi `revoked_token`; `findUnique`; 409 theo trường |
| `backend/src/modules/auth-user/auth/jwt.strategy.ts` | V2 · BM-03 | Bắt buộc `jti`/`exp`, từ chối `jti` đã thu hồi, roles đọc lại từ DB |
| `backend/src/common/interfaces/authenticated-request.interface.ts` | V2 · BM-03 | `JwtPayload` thêm `jti/iat/exp`; `AuthenticatedUser` thêm `jti/tokenExpiresAt` |
| `backend/src/modules/auth-user/auth-user.module.ts` | V2 · BM-03 | `expiresIn` lấy từ cấu hình đã validate (bỏ mặc định `7d`) |
| `backend/src/modules/auth-user/auth/dto/auth-response.dto.ts` | V2 · BM-03 | Ví dụ Swagger `expires_in: '30m'` |
| `frontend/src/shared/lib/token-storage.ts` | V2 · BM-03 | Max-age dự phòng 7 ngày → 30 phút; ghi chú lộ trình HttpOnly |
| `backend/prisma/seed.ts` | V2 · BM-04 | Chặn production; lõi luôn chạy, demo khi `SEED_DEMO=true`; không in mật khẩu; không ghi đè tài khoản mẫu |
| `docker-compose.yml` | V2 · VH-01 | Bind MySQL `127.0.0.1:3307`, phpMyAdmin `127.0.0.1:8080` |
| `docker/mysql/init/01-grant-dev.sql` | V2 · VH-01 | Bỏ `GRANT ALL ON *.*`; quyền shadow DB theo mẫu tên; tạo `green_app` chỉ DML |
| `backend/prisma.config.ts` | V2 · VH-01 | Prisma CLI dùng `MIGRATION_DATABASE_URL` (fallback `DATABASE_URL`) |
| `backend/src/modules/payment-refund/payments/payments.service.ts` | V2 · NV-01 | Đọc `PAYMENT_MOCK_ENABLED` → `mockEnabled` |
| `backend/src/modules/payment-refund/payments/payments.controller.ts` | V2 · NV-01 | `mock-result` trả 404 khi cờ tắt |
| `backend/src/modules/cart-order/checkout/checkout.service.ts` | V2 · NV-01 | Checkout `MOCK` → 403 khi cờ tắt (trước khi giữ hàng) |
| `backend/src/modules/shipment-carbon/shipments/shipments.service.ts` | V2 · NV-01 | COD giao đủ → `PENDING_MANUAL_RECONCILIATION` (không `SUCCEEDED`, không `resolvedAt`) |
| `backend/prisma/schema/payment-refund.prisma` | V2 · NV-01 | Thêm `PaymentStatus.PENDING_MANUAL_RECONCILIATION` |
| `backend/prisma/schema/auth-user.prisma` | V2 · BM-03, V3 · DL-01 | `phone @unique` (bỏ `@@index`); model `RevokedToken` |
| `frontend/src/features/cart-order/types.ts` | V2 · NV-01 | Thêm trạng thái `PENDING_MANUAL_RECONCILIATION` |
| `frontend/src/features/cart-order/components/order-status-timeline.tsx` | V2 · NV-01 | Nhãn/màu "Chờ đối soát"; tiến độ COD không còn ghi "Đã thu" khi chưa đối soát |
| `frontend/src/features/payment-refund/components/payment-history.tsx` | V2 · NV-01 | Màu badge dùng `paymentTone` (trạng thái mới = amber, 5 trạng thái cũ giữ nguyên màu) |
| `frontend/src/features/payment-refund/components/payment-result.tsx` | V2 · NV-01 | COD chờ đối soát vẫn hiển thị là đặt hàng thành công |
| `backend/prisma/migrations/20261125100000_user_phone_unique/migration.sql` *(mới)* | V3 · DL-01 | Chuẩn hóa + khử trùng SĐT (ghi vết `audit_log`) rồi tạo `UNIQUE user_phone_key` |
| `backend/prisma/migrations/20261125100100_revoked_token/migration.sql` *(mới)* | V2 · BM-03 | Bảng `revoked_token` (FK cascade, index `expires_at`, `user_id`) |
| `backend/prisma/migrations/20261125100200_payment_cod_manual_reconciliation/migration.sql` *(mới)* | V2 · NV-01 | Thêm giá trị ENUM cho `payment.status`, `payment_event.status` |
| `package.json` | V3 · QA-01 | `test:unit`, `test:e2e`, `test:all`; `npm test` = `test:all` |
| `backend/package.json` | V3 · QA-01 | `test:unit`, `test:all`; `test` = `test:all` |
| `backend/jest.config.ts` | V3 · QA-01 | `roots` = `src` + `test/unit`; map import `.js` của Prisma Client |
| `backend/test/jest-e2e.json` | V3 · QA-01, NV-01 | Thêm `setupFiles: setup-e2e.ts` |
| `backend/test/setup-e2e.ts` *(mới)* | V3 · QA-01, NV-01 | Đặt `NODE_ENV=test`, `PAYMENT_MOCK_ENABLED=true` trước khi nạp `AppModule` |
| `backend/test/app.e2e-spec.ts` | V3 · QA-01 | Dùng `setupApp`; kiểm envelope thành công/lỗi `{ success, statusCode, ... }` |
| `backend/test/e2e/auth.e2e-spec.ts` | V3 · QA-03, BM-06, DL-01, BM-02/03 | Tách 400/401; hồi quy role; đăng ký đồng thời; hash cũ; endpoint roles; logout thu hồi |
| `backend/test/e2e/checkout-flow.e2e-spec.ts` | V3 · QA-03, NV-01 | Tách 403 (SELLER) / 404 (CUSTOMER khác); chặn giao đơn chưa thanh toán; COD chờ đối soát |
| `backend/test/e2e/green-moderation.e2e-spec.ts` *(xóa)* | V3 · QA-01 | File 0 byte; mọi mã nguồn kiểm duyệt xanh cũng 0 byte |
| `backend/test/unit/carbon-calculator.service.spec.ts` *(xóa)* | V3 · QA-01 | File 0 byte; `carbon-calculator.service.ts` cũng 0 byte |
| `backend/test/unit/green-point-transactions.service.spec.ts` *(xóa)* | V3 · QA-01 | File 0 byte; service tương ứng cũng 0 byte |
| `backend/test/unit/order-split.service.spec.ts` | V3 · QA-01 (checkout) | Điền file 0 byte: chia voucher/điểm không thất thoát, làm tròn |
| `backend/test/unit/payments.service.spec.ts` | V3 · QA-01 (payment), NV-01 | Điền file 0 byte: cờ mock/404, resolve thành công/thất bại/hết hạn/idempotent |
| `backend/test/unit/sub-order.fsm.spec.ts` | V3 · QA-01 (shipment) | Điền file 0 byte: bước chuyển hợp lệ, roll-up trạng thái |
| `backend/test/unit/auth.service.spec.ts` *(mới)* | V3 · QA-01 (auth), BM-06/02/03, DL-01 | Role cố định, P2002 theo trường, rehash, `jti`, logout thu hồi |
| `backend/test/unit/password.util.spec.ts` *(mới)* | V2 · BM-02 | Hash/verify bcrypt, `$2a$`, cost thấp, hash SHA-256 cũ |
| `backend/test/unit/jwt.strategy.spec.ts` *(mới)* | V2 · BM-03 | `jti` thiếu/đã thu hồi → 401; roles từ DB |
| `backend/test/unit/env.validation.spec.ts` *(mới)* | V2 · BM-01/03, NV-01 | Secret production, TTL, cờ mock |
| `backend/test/unit/users.service.spec.ts` *(mới)* | V1 · BM-06 | Đổi quyền + audit, tự đổi quyền, 404, role chưa seed |
| `backend/test/unit/cart.service.spec.ts` *(mới)* | V3 · QA-01 (cart) | Kiểm tồn, gộp số lượng, giới hạn dòng, khóa theo khách |
| `backend/test/unit/checkout.service.spec.ts` *(mới)* | V3 · QA-01 (checkout), NV-01 | `MOCK` → 403 khi cờ tắt, COD vẫn đặt được |
| `backend/test/unit/shipments.service.spec.ts` *(mới)* | V3 · QA-01 (shipment), NV-01 | COD → chờ đối soát; đơn online chưa trả → 409/404 |
| `README.md` | V2 · BM-04, V3 · QA-01 | Dòng seed (`SEED_DEMO`), bảng lệnh test mới, tiêu đề tài khoản mẫu |
| `SETUP.md` | V2 · BM-04, BM-02 | Ghi chú seed demo cần `SEED_DEMO=true`; bcrypt thay SHA-256 |
| `FIX_P0_REPORT.md` *(mới)* | Nghiệm thu | Báo cáo này |

`backend/src/generated/prisma/**` được sinh lại bằng `npx prisma generate` (thư mục bị `.gitignore`, không nằm trong diff). Không chạy formatter toàn cục; line ending CRLF hiện có của từng file được giữ nguyên.

---

## 5. Sai lệch so với dẫn chứng / yêu cầu (Verify-Before-Edit)

Mọi file trong danh sách dẫn chứng đều tồn tại; số dòng lệch trong ±30 và logic khớp mô tả audit. Không hạng mục nào phải dừng. Các điểm khác biệt đã tự định vị và xử lý:

1. **Vị trí audit**: `PROJECT_AUDIT_REPORT.md` không có ở root `main`, chỉ có trên `origin/voyager` (`f239bab`). Đã xác nhận nhánh đó = `main` + đúng 1 file báo cáo, nên dẫn chứng áp dụng nguyên vẹn cho code hiện tại.
2. **Tên biến**: yêu cầu ghi `JWT_SECRET`; mã thực tế dùng `JWT_ACCESS_SECRET` (đã áp dụng cho biến này). `JWT_REFRESH_SECRET` có trong `.env.example` nhưng không được mã nào dùng → chỉ ghi chú "chưa dùng".
3. **Trạng thái "PAID"**: enum thực tế là `SUCCEEDED`, chưa có trạng thái chờ đối soát → thêm `PENDING_MANUAL_RECONCILIATION` (kèm migration).
4. **`error.meta?.target`**: với Prisma 7.10 + `@prisma/adapter-mariadb`, lỗi P2002 **không có `meta.target`**; tên index nằm ở `meta.driverAdapterError.cause.constraint.index` (đã kiểm trong `node_modules`). Bộ bắt lỗi đọc cả hai nguồn (có unit test cho cả hai dạng).
5. **`payment-refund.module.ts:5-9`**: khớp mô tả nhưng **không cần sửa** — `ConfigModule` là global, cờ mock đặt trong `PaymentsService`.
6. **5 file 0 byte trong `test/unit/`**: 3 file có mã nguồn đích (`order-split` → checkout, `payments` → payment, `sub-order.fsm` → shipment) đã được điền. 2 file còn lại nhắm vào service **cũng 0 byte** (không có gì để test) → xóa, thay bằng suite mới cho auth và cart (cùng các suite hồi quy khác). E2E 0 byte `green-moderation` (được audit nêu trong QA-01) cũng bị xóa vì tính năng chưa có mã.
7. **`auth.e2e-spec.ts:187-205`** là cụm test whitelist vai trò (không phải ca khoảng trắng); ca 401→400 nằm ở **242-253**. Đã xử lý cả hai: 187-205 thay bằng hồi quy BM-06; 242-253 tách 400/401.
8. **`npm run typecheck`** không có ở root, backend cũng không có script này → chạy `npm run typecheck -w frontend` và `npx tsc --noEmit` ở backend.
9. **`migrate dev --create-only`** cũng cần kết nối DB (P1001) → sinh DDL offline bằng `prisma migrate diff --from-schema <schema cũ> --to-schema <schema mới> --script` theo từng bước, tạo thư mục migration chuẩn đặt tên Prisma.
10. Quan sát ngoài phạm vi (không sửa): `HttpExceptionFilter` lấy `request.url`, nên với route không khớp trả `path` tương đối (`/khong-ton-tai`) thay vì `/api/khong-ton-tai`. Smoke test đã viết không phụ thuộc chi tiết này.

---

## 6. Migration CSDL — ⚠️ CHƯA APPLY VÀO DB

| Migration | Nội dung | Cách tạo |
|---|---|---|
| `20261125100000_user_phone_unique` | (1) trim SĐT, rỗng → NULL (so độ dài vì collation PAD SPACE); (2) `+84…` → `0…`; (3) SĐT trùng: giữ cho tài khoản tạo sớm nhất, các tài khoản khác bị gỡ SĐT và được ghi `audit_log` action `PHONE_DEDUP_MIGRATION`; (4) `CREATE UNIQUE INDEX user_phone_key` rồi mới `DROP INDEX user_phone_idx` | DDL bước 4 từ `migrate diff`; bước 1–3 viết tay, idempotent, cần MySQL 8+ |
| `20261125100100_revoked_token` | Bảng `revoked_token(jti PK, user_id FK CASCADE, expires_at, revoked_at)` | `migrate diff` nguyên văn |
| `20261125100200_payment_cod_manual_reconciliation` | Thêm `PENDING_MANUAL_RECONCILIATION` vào ENUM `payment.status`, `payment_event.status` | `migrate diff` nguyên văn |

Đã kiểm: `prisma validate` OK, `prisma generate` OK. Chưa kiểm: chạy thật trên MySQL (cần `prisma migrate dev` — Prisma sẽ áp vào shadow DB và báo drift nếu có).

> ⚠️ **Phải apply migration TRƯỚC khi chạy backend mới**: `JwtStrategy` truy vấn `revoked_token` ở mọi request có xác thực — thiếu bảng này mọi API cần đăng nhập sẽ trả 500.

---

## 7. Ops — việc cần làm khi có DB / trước khi triển khai

### 7.1 Thứ tự áp dụng

1. Bật Docker Desktop → `npm run db:up` (container được tạo lại để áp bind `127.0.0.1`; volume dữ liệu giữ nguyên).
2. Cập nhật `backend/.env` theo `backend/.env.example` (file này không được Git theo dõi nên **không bị sửa**). Hiện `.env` cục bộ vẫn dùng **đúng khóa JWT mẫu** và `JWT_ACCESS_EXPIRES_IN=7d`, chưa có `PAYMENT_MOCK_ENABLED` (→ cổng mock **tắt**: thanh toán online mô phỏng trả 404/403 cho tới khi đặt `true`), chưa có `SEED_DEMO`, `MIGRATION_DATABASE_URL`.
3. Tạo tài khoản `green_app` (volume mới tự tạo; volume cũ xem 7.6).
4. Chạy SQL kiểm tra SĐT trùng (7.3).
5. `npx -w backend prisma migrate dev` (dev) hoặc `npx -w backend prisma migrate deploy` (production).
6. `npx -w backend prisma db seed` (thêm `SEED_DEMO=true` nếu cần dữ liệu demo).
7. `npm run test:all` — kỳ vọng unit + E2E đều pass.

### 7.2 BM-06 — rà soát tài khoản giữ quyền khác CUSTOMER

```sql
-- (a) Mọi tài khoản đang có vai trò khác CUSTOMER (tài khoản demo *@greenshopping.vn là bình thường)
SELECT u.user_id, u.email, u.phone, u.status, u.created_at, r.name AS role_name, ur.assigned_at
FROM `user` u
JOIN `user_role` ur ON ur.user_id = u.user_id
JOIN `role` r ON r.role_id = ur.role_id
WHERE r.name <> 'CUSTOMER'
ORDER BY ur.assigned_at DESC;

-- (b) Dấu hiệu khai thác BM-06: tài khoản TỰ ĐĂNG KÝ nhưng nhận vai trò ≠ CUSTOMER ngay lúc đăng ký
SELECT a.entity_id AS user_id, u.email, u.status, a.created_at AS registered_at,
       JSON_UNQUOTE(JSON_EXTRACT(a.new_value, '$.roles[0]')) AS role_at_register,
       a.note AS request_meta
FROM `audit_log` a
LEFT JOIN `user` u ON u.user_id = a.entity_id
WHERE a.action = 'REGISTER'
  AND JSON_UNQUOTE(JSON_EXTRACT(a.new_value, '$.roles[0]')) <> 'CUSTOMER'
ORDER BY a.created_at DESC;

-- (c) Nhật ký đăng nhập của các tài khoản ở (b) để rà truy cập
SELECT a.actor_user_id, a.action, a.created_at, a.note
FROM `audit_log` a
WHERE a.action IN ('LOGIN', 'LOGOUT')
  AND a.actor_user_id IN (
    SELECT r.entity_id FROM `audit_log` r
    WHERE r.action = 'REGISTER'
      AND JSON_UNQUOTE(JSON_EXTRACT(r.new_value, '$.roles[0]')) <> 'CUSTOMER')
ORDER BY a.created_at;
```

Xử lý: hạ quyền qua `PATCH /api/users/:id/roles` với body `{"role":"CUSTOMER"}` bằng tài khoản ADMIN (có audit). Thu hồi phiên: sau khi deploy, **mọi token phát hành trước đó (không có `jti`) đều bị từ chối**; nếu khóa mẫu từng được dùng ở môi trường công khai, xoay `JWT_ACCESS_SECRET`.

### 7.3 DL-01 — SĐT trùng

```sql
-- Trước migration: SĐT trùng sau khi chuẩn hóa giống migration (trim, +84 → 0)
SELECT norm_phone, COUNT(*) AS so_tai_khoan,
       GROUP_CONCAT(user_id ORDER BY created_at, user_id) AS user_ids
FROM (
  SELECT user_id, created_at,
         CASE WHEN TRIM(phone) LIKE '+84%' THEN CONCAT('0', SUBSTRING(TRIM(phone), 4))
              ELSE TRIM(phone) END AS norm_phone
  FROM `user`
  WHERE phone IS NOT NULL AND CHAR_LENGTH(TRIM(phone)) > 0
) t
GROUP BY norm_phone
HAVING COUNT(*) > 1;

-- Sau migration: tài khoản bị gỡ SĐT, cần liên hệ khách xác minh lại
SELECT entity_id AS user_id, old_value, new_value, created_at
FROM `audit_log` WHERE action = 'PHONE_DEDUP_MIGRATION';
```

### 7.4 BM-02 — tiến độ chuyển hash

```sql
SELECT COUNT(*) AS so_hash_sha256_cu FROM `user` WHERE password_hash NOT LIKE '$2%';
```

### 7.5 NV-01 — tiền COD

```sql
-- Khoản COD đang chờ đối soát
SELECT payment_id, master_order_id, amount, created_at
FROM `payment` WHERE status = 'PENDING_MANUAL_RECONCILIATION' ORDER BY created_at;

-- Khoản COD đã bị logic CŨ tự đánh dấu SUCCEEDED khi giao xong (không có xác nhận thu tiền độc lập)
SELECT payment_id, master_order_id, amount, resolved_at
FROM `payment` WHERE method = 'COD' AND status = 'SUCCEEDED' AND amount > 0;
```

### 7.6 VH-01 — áp quyền mới cho volume MySQL đã tồn tại (không xóa dữ liệu)

Script init chỉ chạy khi volume trống. Thay vì `docker compose down -v` (**mất dữ liệu**), có thể chạy bằng root (mật khẩu root dev mặc định trong `docker-compose.yml`):

```sql
CREATE USER IF NOT EXISTS 'green_app'@'%' IDENTIFIED BY 'green_app_dev_pw';
GRANT SELECT, INSERT, UPDATE, DELETE ON `green_shopping`.* TO 'green_app'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'green'@'%';
GRANT ALL PRIVILEGES ON `green_shopping`.* TO 'green'@'%';
GRANT ALL PRIVILEGES ON `prisma\_migrate\_shadow\_db\_%`.* TO 'green'@'%';
FLUSH PRIVILEGES;
```

Ví dụ: `docker exec -i green-shopping-mysql mysql -uroot -p < grants.sql`. Ghi chú: GRANT có ký tự đại diện trong tên database bị đánh dấu deprecated từ MySQL 8.2 (vẫn chạy trên 8.4) — thay thế lâu dài là `shadowDatabaseUrl` cố định.

### 7.7 Lưu ý tương thích (thay đổi hành vi)

- Toàn bộ người dùng phải **đăng nhập lại** sau khi deploy (token cũ không có `jti`). Access token hết hạn sau **30 phút** và chưa có refresh token.
- Form đăng ký không còn chọn vai trò; tài khoản SELLER/STAFF/ADMIN chỉ được cấp qua `PATCH /api/users/:id/roles` (chưa có UI quản trị).
- Cổng thanh toán mô phỏng **tắt mặc định**; bật bằng `PAYMENT_MOCK_ENABLED=true` cho dev/demo. FE vẫn hiển thị lựa chọn này và sẽ nhận thông báo 403 khi cờ tắt.
- Seed không còn in mật khẩu, không tạo dữ liệu demo nếu thiếu `SEED_DEMO=true`, không đặt lại tài khoản mẫu đã tồn tại.
- Sau khi pull: chạy `npx -w backend prisma generate` (Prisma Client không được commit).

---

## 8. Hạng mục riêng (PR sau): chuyển phiên sang cookie `HttpOnly` — BM-03

Không làm trong P0 vì cần sửa đồng thời backend (phát cookie, đọc cookie, CSRF), CORS, Axios, Next middleware và cách triển khai FE/BE cùng site. Hiện tại token vẫn nằm trong cookie do JavaScript ghi (`SameSite=Lax`, `Secure` khi HTTPS, hạn = hạn JWT); API dùng header `Authorization` nên chưa phát sinh rủi ro CSRF. Đề xuất:

1. **Backend**: login set `Set-Cookie: gs_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<TTL>`; thêm `cookie-parser`; `JwtStrategy` đọc từ cookie (giữ Bearer cho client không phải trình duyệt); logout xóa cookie + thu hồi `jti` (đã có).
2. **CSRF** (bắt buộc khi trình duyệt tự gửi cookie): double-submit token (cookie đọc được + header `X-CSRF-Token`) cho mọi request ghi, kiểm tra thêm `Origin`/`Referer`.
3. **CORS/FE**: giữ `credentials: true` với origin chính xác; Axios `withCredentials: true`; bỏ `token-storage.ts` khỏi việc giữ JWT; `middleware.ts` chỉ dùng cookie gợi ý vai trò (không nhạy cảm) hoặc gọi `/auth/me`.
4. **Triển khai**: FE và API cùng site (cùng registrable domain) hoặc reverse proxy chung origin `/api` để tránh chặn cookie bên thứ ba.
5. **Refresh token xoay vòng** (`JWT_REFRESH_SECRET` đã có chỗ trong `.env.example`) để giữ access token 15–30 phút mà không bắt đăng nhập lại liên tục.
6. **Test**: E2E kiểm cờ cookie, request ghi thiếu CSRF bị 403, logout xóa cookie và token cũ bị 401.

---

## 9. Tồn đọng

| # | Việc | Liên quan |
|---|---|---|
| 1 | PR riêng: cookie `HttpOnly` + CSRF + refresh token (mục 8) | BM-03 |
| 2 | Chạy E2E trên MySQL (`npm run test:all`) và apply 3 migration | QA-03, DL-01, BM-06, NV-01 |
| 3 | Chạy SQL rà soát mục 7.2–7.5 trên mọi môi trường từng mở cho người ngoài; xoay JWT secret nếu cần | BM-06, BM-01, DL-01, NV-01 |
| 4 | Luồng đối soát COD: endpoint/UI ADMIN chuyển `PENDING_MANUAL_RECONCILIATION` → `SUCCEEDED`/`FAILED` có audit | NV-01 |
| 5 | FE ẩn lựa chọn "Thanh toán online mô phỏng" khi cờ tắt (cần endpoint cấu hình công khai) | NV-01 |
| 6 | UI quản trị gán vai trò (`assign-role-dialog.tsx`, `user-api.ts` đang 0 byte) | BM-06 |
| 7 | TLS có kiểm tra chứng chỉ cho kết nối DB từ xa; bỏ `allowPublicKeyRetrieval` ở production | VH-01 |
| 8 | Hạn buộc đổi mật khẩu cho tài khoản còn hash SHA-256, sau đó bỏ `PASSWORD_SALT` | BM-02 |
| 9 | Quy trình khởi tạo role/permission cho production (seed bị chặn ở production) | BM-04 |
| 10 | NV-02, NV-03 (cùng dòng P0 của lộ trình audit, ngoài phạm vi đợt này) | NV-02, NV-03 |
