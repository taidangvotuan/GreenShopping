# GreenShopping

Sàn thương mại điện tử dành cho sản phẩm xanh — monorepo **npm workspaces** gồm:

| Thư mục | Công nghệ | Cổng | Địa chỉ |
|---|---|---|---|
| `frontend/` | Next.js (App Router) + Tailwind CSS | `3000` | http://localhost:3000 |
| `backend/` | NestJS + Prisma 7 | `3001` | http://localhost:3001/api — Swagger: http://localhost:3001/api/docs |
| Docker | MySQL 8.4 + phpMyAdmin | `3307` / `8080` (đổi được qua `PMA_HOST_PORT`) | http://localhost:8080 |

> Hướng dẫn cài đặt chi tiết và xử lý lỗi thường gặp: xem [SETUP.md](SETUP.md).
> Mọi lệnh dưới đây chạy ở **thư mục gốc** của repo (PowerShell hoặc Git Bash đều được).

---

## 1. Yêu cầu

- Node.js **LTS** (22 hoặc 24), npm
- Docker Desktop (đang ở trạng thái *Engine running*)

## 2. Cài đặt lần đầu

```bash
npm install                                  # cài thư viện cho cả frontend + backend (một lần ở gốc)
cp backend/.env.example backend/.env         # PowerShell: Copy-Item backend\.env.example backend\.env
cp backend/.env.test.example backend/.env.test # cấu hình E2E: MySQL test riêng :3308, không phải DB dev
npm run db:up                                # bật MySQL :3307 + phpMyAdmin :8080 (đợi ~30s lần đầu)
npx -w backend prisma generate               # sinh Prisma Client
npx -w backend prisma migrate dev            # tạo bảng
npx -w backend prisma db seed                # tạo role; thêm tài khoản mẫu khi SEED_DEMO=true (backend/.env)
```

> **Lỗi `pool failed to retrieve a connection from pool` khi seed hoặc chạy backend:** tài khoản ứng dụng
> `green_app` chưa được tạo. Script [docker/mysql/init/01-grant-dev.sql](docker/mysql/init/01-grant-dev.sql)
> chỉ tự chạy khi volume MySQL còn trống, nên volume tạo từ trước sẽ thiếu tài khoản này. Chạy script thủ công
> (giữ nguyên dữ liệu), dùng Git Bash:
> `docker exec -i green-shopping-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < docker/mysql/init/01-grant-dev.sql`
> Hoặc xóa sạch DB rồi tạo lại: `docker compose down -v`, sau đó `npm run db:up`.

Frontend mặc định gọi API tại `http://localhost:3001/api`. Muốn đổi, tạo `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 3. Chạy ở chế độ phát triển

**Chạy cả hai cùng lúc** (một terminal, log có tiền tố `[FE]` / `[BE]`):

```bash
npm run dev
```

**Hoặc chạy riêng từng phần** (mỗi lệnh một terminal):

```bash
# Backend — NestJS, tự khởi động lại khi sửa code
npm run start:dev -w backend

# Frontend — Next.js dev server
npm run dev -w frontend
```

> Chạy backend trước: frontend cần API ở cổng `3001` để đăng nhập, xem giỏ hàng, thanh toán.

## 4. Build & chạy bản production

```bash
# Backend
npm run build -w backend
npm run start:prod -w backend        # chạy dist/main

# Frontend
npm run build -w frontend
npm run start -w frontend            # phục vụ bản build ở cổng 3000
```

## 5. Kiểm tra code & kiểm thử

| Lệnh | Tác dụng |
|---|---|
| `npm run typecheck -w frontend` | Kiểm tra kiểu TypeScript cho frontend |
| `npm run lint -w backend` | Lint backend (oxlint) |
| `npm test` / `npm run test:all` | Unit + E2E backend; phần E2E tự bật MySQL test và `migrate deploy` trước khi chạy (**cần Docker**) |
| `npm run test:unit` | Chỉ unit test backend (không cần MySQL) |
| `npm run test:e2e:db` | Chỉ E2E: bật MySQL test → `migrate deploy` → chạy E2E |
| `npm run test:e2e -w backend` | Chỉ chạy E2E (**MySQL test phải đang chạy**: `npm run db:test:up`) |
| `npm run test:e2e -w backend -- auth` | Chỉ chạy E2E luồng đăng ký / đăng nhập |
| `npm run gen:api` | Sinh lại kiểu API cho frontend từ Swagger (**cần backend đang chạy**) |

> E2E chạy trên **MySQL test riêng** (`127.0.0.1:3308`, database `greenshopping_test`, xem
> [docker-compose.test.yml](docker-compose.test.yml)) và đọc cấu hình từ `backend/.env.test`.
> [backend/test/test-database-guard.ts](backend/test/test-database-guard.ts) **từ chối chạy** nếu `DATABASE_URL`
> hoặc `MIGRATION_DATABASE_URL` không trỏ tới database có tên kết thúc bằng `_test`, nên test không bao giờ
> ghi vào DB dev `green_shopping`. Chi tiết dựng DB test: [MIGRATE_E2E_LOG.md](MIGRATE_E2E_LOG.md).

## 6. Tài khoản mẫu (sau khi seed với `SEED_DEMO=true`, chỉ dùng trên máy phát triển)

| Vai trò | Email | Mật khẩu | Màn hình sau đăng nhập |
|---|---|---|---|
| Customer | `customer@greenshopping.vn` | `Customer@123` | Trang chủ cửa hàng |
| Seller | `seller@greenshopping.vn` | `Seller@123` | `/seller/dashboard` |
| Staff | `staff@greenshopping.vn` | `Staff@123` | `/admin/dashboard` (bản Staff) |
| Admin | `admin@greenshopping.vn` | `Admin@123` | `/admin/dashboard` |

## 7. Lệnh Docker / Database thường dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run db:up` | Bật MySQL + phpMyAdmin |
| `npm run db:down` | Tắt container (giữ dữ liệu) |
| `npm run db:test:up` / `npm run db:test:down` | Bật / tắt MySQL test riêng cho E2E (cổng `3308`; tắt vẫn giữ dữ liệu) |
| `docker compose down -v` | Tắt và **xóa toàn bộ dữ liệu** DB |
| `npx -w backend prisma migrate reset` | Xóa sạch DB, chạy lại toàn bộ migration. Prisma 7 **không** tự seed → chạy tiếp `npx -w backend prisma db seed` |
| `npx -w backend prisma studio` | Giao diện xem/sửa dữ liệu trên trình duyệt |
