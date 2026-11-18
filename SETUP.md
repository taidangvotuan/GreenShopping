# Hướng dẫn cài đặt môi trường phát triển — Green Shopping
 
Tài liệu dành cho thành viên mới clone repo về máy. Làm lần lượt từ trên xuống, mỗi bước có phần **Kiểm tra** để biết đã làm đúng chưa.
 
> Các lệnh trong tài liệu dùng **PowerShell** trên Windows và chạy ở **thư mục gốc** của repo (ví dụ `E:\GreenShopping`), trừ khi ghi khác.
 
---
 
## Mục lục
 
1. [Công nghệ sử dụng](#1-công-nghệ-sử-dụng)
2. [Cài công cụ trên máy](#2-cài-công-cụ-trên-máy)
3. [Clone repo và tạo file môi trường](#3-clone-repo-và-tạo-file-môi-trường)
4. [Khởi động cơ sở dữ liệu MySQL](#4-khởi-động-cơ-sở-dữ-liệu-mysql)
5. [Cài thư viện và tạo bảng](#5-cài-thư-viện-và-tạo-bảng)
6. [Chạy ứng dụng](#6-chạy-ứng-dụng)
7. [Các lệnh thường dùng](#7-các-lệnh-thường-dùng)
8. [Xử lý lỗi thường gặp](#8-xử-lý-lỗi-thường-gặp)
9. [Quy ước làm việc nhóm](#9-quy-ước-làm-việc-nhóm)
---
 
## 1. Công nghệ sử dụng
 
| Tầng | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | Cổng `3000` |
| Backend | NestJS (CommonJS) + TypeScript | Cổng `3001`, mọi API có tiền tố `/api` |
| ORM | Prisma ORM **7** + `@prisma/adapter-mariadb` | Schema chia theo miền trong `backend/prisma/schema/` |
| Database | MySQL **8.4** (Docker) | Cổng máy `3307` → cổng container `3306` |
| Quản trị DB | phpMyAdmin (Docker) | Cổng `8080` |
| Quản lý mã nguồn | npm workspaces (`frontend`, `backend`) | Cài thư viện **một lần ở thư mục gốc** |
 
Cấu trúc thư mục chính:
 
```
GreenShopping/
├── package.json            # npm workspaces + script chung
├── docker-compose.yml      # MySQL 8.4 + phpMyAdmin
├── docker/mysql/init/      # Script SQL chạy khi tạo container lần đầu
├── docs/                   # SRS, UML, ERD, báo cáo
├── frontend/               # Next.js
└── backend/                # NestJS + Prisma
    ├── prisma.config.ts    # Cấu hình Prisma CLI (đọc DATABASE_URL)
    ├── prisma/schema/      # *.prisma chia theo miền nghiệp vụ
    ├── prisma/migrations/  # Lịch sử thay đổi DB (CÓ commit)
    └── src/generated/      # Prisma Client sinh tự động (KHÔNG commit)
```
 
---
 
## 2. Cài công cụ trên máy
 
| Công cụ | Phiên bản | Tải về |
|---|---|---|
| Node.js | Bản **LTS** (22 hoặc 24) | https://nodejs.org |
| Git | Mới nhất | https://git-scm.com |
| Docker Desktop | Mới nhất (cần WSL 2 trên Windows) | https://www.docker.com/products/docker-desktop |
| VS Code | Mới nhất | https://code.visualstudio.com |
 
Extension VS Code nên cài: **ESLint**, **Prettier**, **Prisma**, **Tailwind CSS IntelliSense**, **PlantUML**.
 
**Kiểm tra:**
 
```powershell
node -v      # v22.x.x hoặc v24.x.x
npm -v
git --version
docker --version
```
 
---
 
## 3. Clone repo và tạo file môi trường
 
```powershell
git clone https://github.com/taidangvotuan/GreenShopping.git
cd GreenShopping
```
 
Tạo file `.env` cho backend từ file mẫu:
 
```powershell
Copy-Item backend\.env.example backend\.env
```
 
Mở `backend\.env` và kiểm tra dòng kết nối DB:
 
```
DATABASE_URL="mysql://green:green_dev_pw@localhost:3307/green_shopping"
```
 
> ⚠️ File `.env` chứa mật khẩu và JWT secret — **không bao giờ commit** file này. Nó đã có trong `.gitignore`.
 
**Kiểm tra:** lệnh sau phải in ra đúng một dòng tên `.env` (không phải `.env.txt`):
 
```powershell
Get-ChildItem backend -Force -Filter ".env*"
```
 
---
 
## 4. Khởi động cơ sở dữ liệu MySQL
 
1. Mở **Docker Desktop**, đợi góc dưới bên trái hiện **Engine running**.
2. Chạy:
```powershell
npm run db:up
```
 
(Tương đương `docker compose up -d`.)
 
3. **Đợi 30–40 giây** ở lần chạy đầu tiên. MySQL phải khởi tạo dữ liệu và tự khởi động lại một lần; kết nối trong khoảng thời gian này sẽ bị từ chối.
**Kiểm tra:**
 
```powershell
docker compose ps
```
 
Cột `STATUS` của `green-shopping-mysql` phải là `Up ... (healthy)`.
 
```powershell
docker compose logs mysql --tail 5
```
 
Dòng cuối phải có `ready for connections ... port: 3306` (lưu ý **3306**, không phải `port: 0`).
 
Mở http://localhost:8080 (phpMyAdmin), đăng nhập `green` / `green_dev_pw` để xem DB.
 
---
 
## 5. Cài thư viện và tạo bảng
 
```powershell
# Cài thư viện cho cả frontend và backend (chỉ chạy ở thư mục gốc)
npm install
 
# Sinh Prisma Client vào backend/src/generated/prisma
npx -w backend prisma generate
 
# Tạo bảng trong MySQL theo các migration đã có trong repo
npx -w backend prisma migrate dev
```
 
> Script `postinstall` trong `backend/package.json` đã tự chạy `prisma generate` sau `npm install`, nhưng chạy thêm một lần cũng không sao.
 
**Kiểm tra:**
 
- `migrate dev` in ra `Your database is now in sync with your schema`.
- Thư mục `backend/src/generated/prisma/` đã xuất hiện.
- Trong phpMyAdmin, database `green_shopping` có các bảng (`user`, `role`, `user_role`, `address`, ...).
Nạp dữ liệu mẫu (role, permission, 4 tài khoản mẫu — chạy lại nhiều lần không bị trùng):
 
```powershell
npx -w backend prisma db seed
```

| Vai trò | Email | Mật khẩu | Trang sau đăng nhập |
|---|---|---|---|
| ADMIN | `admin@greenshopping.vn` | `Admin@123` | `/admin/dashboard` |
| STAFF | `staff@greenshopping.vn` | `Staff@123` | `/admin/dashboard` |
| SELLER | `seller@greenshopping.vn` | `Seller@123` | `/seller/dashboard` |
| CUSTOMER | `customer@greenshopping.vn` | `Customer@123` | `/` |

> Mật khẩu băm bằng SHA-256 + `PASSWORD_SALT` trong `backend/.env`. Đổi `PASSWORD_SALT` thì phải chạy lại seed.

Chạy E2E test cho Auth (cần MySQL đang chạy và đã migrate):

```powershell
npm run test:e2e -w backend -- auth
```
 
---
 
## 6. Chạy ứng dụng
 
```powershell
npm run dev
```
 
Lệnh này chạy song song frontend (`[FE]`) và backend (`[BE]`) trong cùng một cửa sổ terminal.
 
**Kiểm tra:**
 
| Địa chỉ | Kết quả mong đợi |
|---|---|
| http://localhost:3000 | Trang chủ Next.js |
| http://localhost:3001/api | `Hello World!` |
| http://localhost:8080 | phpMyAdmin |
 
Log backend có dòng `Nest application successfully started`.
 
---
 
## 7. Các lệnh thường dùng
 
Tất cả chạy ở **thư mục gốc**.
 
### Chạy và dừng
 
| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy frontend + backend |
| `npm run db:up` | Bật MySQL + phpMyAdmin |
| `npm run db:down` | Tắt container (giữ dữ liệu) |
| `docker compose down -v` | Tắt **và xóa toàn bộ dữ liệu DB** — cẩn thận |
 
### Cài thêm thư viện
 
Luôn thêm `-w frontend` hoặc `-w backend`, **không** `cd` vào thư mục con để cài:
 
```powershell
npm i axios -w frontend
npm i @nestjs/jwt -w backend
npm i -D @types/bcrypt -w backend
```
 
### Prisma
 
| Lệnh | Khi nào dùng |
|---|---|
| `npx -w backend prisma generate` | Sau khi sửa bất kỳ file `*.prisma` nào |
| `npx -w backend prisma migrate dev --name <ten>` | Sau khi sửa schema và muốn cập nhật DB. Ví dụ `--name add_shop_table` |
| `npx -w backend prisma migrate dev` | Sau khi `git pull` có migration mới của người khác |
| `npx -w backend prisma migrate reset` | Xóa sạch DB, chạy lại toàn bộ migration + seed |
| `npx -w backend prisma studio` | Mở giao diện xem/sửa dữ liệu trên trình duyệt |
 
### Tạo file NestJS mới
 
```powershell
cd backend
npx nest g module modules/shop-product
npx nest g controller modules/shop-product/shops --flat
npx nest g service modules/shop-product/shops --flat
cd ..
```
 
---
 
## 8. Xử lý lỗi thường gặp
 
### `npm error code EJSONPARSE ... parsing empty string`
 
Có một file `package.json` **rỗng** (thường do tạo sẵn file trống theo cây thư mục hoặc chưa bấm Ctrl+S). Tìm file rỗng:
 
```powershell
Get-ChildItem -Recurse -Filter package.json | Where-Object { $_.FullName -notmatch 'node_modules' } | Select-Object FullName, Length
```
 
File nào có `Length` = `0` là thủ phạm.
 
---
 
### `A merge conflicted on path "/backend/nest-cli.json"` (khi tạo dự án)
 
Thư mục `backend/` (hoặc `frontend/`) đã có sẵn file. Nest CLI và `create-next-app` chỉ tạo được dự án vào thư mục **chưa tồn tại hoặc trống**:
 
```powershell
Rename-Item backend backend_old
npx @nestjs/cli new backend --skip-git --skip-install --package-manager npm
# chép lại file cần giữ từ backend_old, rồi xóa backend_old
```
 
Khi Nest CLI hỏi module system → chọn **CJS**.
 
---
 
### `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
 
Docker Desktop **chưa chạy**. Mở Docker Desktop, đợi **Engine running**, chạy lại lệnh.
 
---
 
### `Cannot find module 'prisma/config'` / `'dotenv/config'` (gạch đỏ trong VS Code)
 
Chưa cài thư viện:
 
```powershell
npm install
```
 
Nếu vẫn đỏ: `Ctrl + Shift + P` → **TypeScript: Restart TS Server**.
 
---
 
### `Cannot find module '../generated/prisma/client'` / `Property '$connect' does not exist`
 
Chưa sinh Prisma Client:
 
```powershell
npx -w backend prisma generate
```
 
---
 
### `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`
 
Chưa có file `backend/.env`. Làm lại [bước 3](#3-clone-repo-và-tạo-file-môi-trường).
 
---
 
### `P1000: Authentication failed ... credentials for 'green' are not valid`
 
Thường do **máy đã cài MySQL khác** (XAMPP, Laragon, MySQL Server) chiếm cổng 3306, Prisma kết nối nhầm sang đó. Repo đã dùng cổng **3307** để tránh việc này — kiểm tra:
 
1. `docker-compose.yml` có `ports: - "3307:3306"`.
2. `backend/.env` có `@localhost:3307/`.
3. Cổng 3307 không bị chiếm bởi chương trình khác:
```powershell
netstat -ano | findstr :3307
```
 
Nếu vẫn lỗi, có thể container được tạo từ trước với mật khẩu khác (MySQL chỉ tạo user ở lần chạy đầu):
 
```powershell
docker compose down -v
docker compose up -d
```
 
---
 
### `P1017: Server has closed the connection`
 
- **Nếu vừa chạy `db:up`:** MySQL chưa khởi động xong. Đợi đến khi log có `ready for connections ... port: 3306` rồi chạy lại.
- **Nếu MySQL đã sẵn sàng mà vẫn lỗi:** do cơ chế xác thực `caching_sha2_password` của MySQL 8.4. Repo đã xử lý bằng cách bật `--mysql-native-password=ON` trong `docker-compose.yml` và chuyển user `green` sang `mysql_native_password` trong `docker/mysql/init/01-grant-dev.sql`. Script init chỉ chạy khi tạo container lần đầu, nên nếu container cũ được tạo trước khi có thay đổi này:
```powershell
docker compose down -v
docker compose up -d
```
 
> Cấu hình này **chỉ dùng cho môi trường dev**. Môi trường thật dùng `caching_sha2_password` kèm kết nối TLS.
 
---
 
### `P3014: Prisma Migrate could not create the shadow database`
 
User `green` thiếu quyền tạo database tạm. Script `01-grant-dev.sql` đã cấp quyền này; tạo lại container như trên để script được chạy.
 
---
 
### `Module '"./app.module"' has no exported member 'ObserveInstrument'`
 
Nest CLI bản mới tự bật NestJS Observe (dịch vụ giám sát cần đăng ký tài khoản). Dự án không dùng tính năng này:
 
```powershell
npm uninstall @nestjs/observe -w backend
```
 
Xóa import `ObserveInstrument` và tùy chọn `instrument` trong `backend/src/main.ts`; xóa `createObserveModule`/`ObserveModule` trong `app.module.ts`.
 
---
 
### `Nest can't resolve dependencies of the PrismaService (?)`
 
`AppModule` thiếu `ConfigModule`. Kiểm tra `backend/src/app.module.ts` có:
 
```typescript
imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
```
 
---
 
### `Cannot find module '.../dist/main'`
 
`prisma.config.ts` bị đưa vào bản build. Kiểm tra `backend/tsconfig.build.json`:
 
```json
"exclude": ["node_modules", "test", "dist", "**/*spec.ts", "prisma.config.ts", "prisma"]
```
 
---
 
## 9. Quy ước làm việc nhóm
 
### Phân công miền nghiệp vụ
 
| Thành viên | Miền |
|---|---|
| A | `auth-user`, `shop-product`, `green-coins`, `reports` |
| B | `cart-order`, `shipment-carbon`, `payment-refund`, `promotion` |
 
Mỗi người sửa file `*.prisma`, `modules/<miền>/` và `features/<miền>/` của mình. File dùng chung (`base.prisma`, `common/`, `shared/`) → báo người kia trước khi sửa.
 
### Quy ước schema Prisma (khớp từ điển dữ liệu Chương 3)
 
| Báo cáo | Prisma |
|---|---|
| Tên bảng `user_role` | `model UserRole { ... @@map("user_role") }` |
| Cột `created_at` | `createdAt DateTime @map("created_at")` |
| `CHAR(36)` PK | `String @id @default(uuid()) @db.Char(36)` |
| `TIMESTAMP` mặc định | `DateTime @default(now()) @db.Timestamp(0)` |
| Tiền tệ | `Decimal @db.Decimal(12, 2)` — không dùng `Float` |
| Trạng thái | `enum` Prisma → cột `ENUM` của MySQL |
 
Xem file mẫu `backend/prisma/schema/auth-user.prisma`.
 
### Quy trình khi sửa schema
 
1. Sửa file `*.prisma` của miền mình.
2. `npx -w backend prisma migrate dev --name <mo_ta_ngan>`
3. Commit **cả file `.prisma` lẫn thư mục migration mới** trong cùng một commit.
4. Người kia `git pull` → `npx -w backend prisma migrate dev`.
> ⚠️ Không sửa tay file trong `prisma/migrations/` đã được push. Không xóa migration của người khác.
 
### Quy ước commit
 
```
<loại>(<miền>): <mô tả ngắn>
```
 
| Loại | Dùng khi | Ví dụ |
|---|---|---|
| `feat` | Thêm chức năng | `feat(cart-order): tách Master Order thành Sub-order theo Shop` |
| `fix` | Sửa lỗi | `fix(green-coins): chặn cộng điểm trùng khi order.delivered lặp` |
| `chore` | Cấu hình, cài đặt | `chore: thêm Swagger và script gen:api` |
| `docs` | Tài liệu, UML, báo cáo | `docs(erd): cập nhật bảng CarbonMetric` |
| `test` | Kiểm thử | `test(carbon): kiểm thử công thức CO2e` |
| `refactor` | Sắp xếp lại code | `refactor(auth-user): tách RolesGuard ra common` |
 
### Không commit
 
`.env`, `node_modules/`, `backend/src/generated/`, `backend/uploads/`, `frontend/.next/`, `backend/dist/` — đã có trong `.gitignore`.
 
### Có commit
 
`.env.example`, `package-lock.json`, `backend/prisma/migrations/`, `frontend/src/shared/types/api.generated.ts`.
 