# GreenShopping

Sàn thương mại điện tử dành cho sản phẩm xanh — monorepo **npm workspaces** gồm:

| Thư mục | Công nghệ | Cổng | Địa chỉ |
|---|---|---|---|
| `frontend/` | Next.js (App Router) + Tailwind CSS | `3000` | http://localhost:3000 |
| `backend/` | NestJS + Prisma 7 | `3001` | http://localhost:3001/api — Swagger: http://localhost:3001/api/docs |
| Docker | MySQL 8.4 + phpMyAdmin | `3307` / `8080` | http://localhost:8080 |

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
npm run db:up                                # bật MySQL :3307 + phpMyAdmin :8080 (đợi ~30s lần đầu)
npx -w backend prisma generate               # sinh Prisma Client
npx -w backend prisma migrate dev            # tạo bảng
npx -w backend prisma db seed                # tạo role + tài khoản mẫu
```

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
| `npm test` | Unit test backend |
| `npm run test:e2e -w backend` | E2E test backend (**cần MySQL đang chạy**) |
| `npm run test:e2e -w backend -- auth` | Chỉ chạy E2E luồng đăng ký / đăng nhập |
| `npm run gen:api` | Sinh lại kiểu API cho frontend từ Swagger (**cần backend đang chạy**) |

## 6. Tài khoản mẫu (sau khi seed)

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
| `docker compose down -v` | Tắt và **xóa toàn bộ dữ liệu** DB |
| `npx -w backend prisma migrate reset` | Xóa sạch DB, chạy lại migration + seed |
| `npx -w backend prisma studio` | Giao diện xem/sửa dữ liệu trên trình duyệt |
