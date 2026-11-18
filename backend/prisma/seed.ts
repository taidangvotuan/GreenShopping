/**
 * Seed dữ liệu nền cho Miền 1 (Auth & User) — IDEMPOTENT (chạy lại nhiều lần không trùng).
 * Chạy: npx -w backend prisma db seed
 *
 * - 4 Role: CUSTOMER, SELLER, STAFF, ADMIN
 * - Permission cơ bản theo miền + gán RolePermission
 * - 4 tài khoản mẫu (kèm UserRole + GreenPointAccount balance = 0)
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/common/utils/password.util';

const databaseUrl = process.env.DATABASE_URL;
const salt = process.env.PASSWORD_SALT;
if (!databaseUrl || !salt) {
  throw new Error('Thiếu DATABASE_URL hoặc PASSWORD_SALT trong backend/.env');
}

const url = new URL(databaseUrl);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
  }),
});

type RoleName = 'CUSTOMER' | 'SELLER' | 'STAFF' | 'ADMIN';

const ROLES: { name: RoleName; description: string }[] = [
  { name: 'CUSTOMER', description: 'Khách hàng mua sản phẩm xanh, tích điểm Green Point' },
  { name: 'SELLER', description: 'Người bán — quản lý shop, sản phẩm, đơn hàng của shop' },
  { name: 'STAFF', description: 'Nhân viên vận hành — kiểm duyệt shop, sản phẩm, đánh giá xanh' },
  { name: 'ADMIN', description: 'Quản trị viên — toàn quyền hệ thống' },
];

// permission_code = "<resource>:<action>"
const PERMISSIONS: { code: string; name: string; description?: string }[] = [
  // auth
  { code: 'auth:login', name: 'Đăng nhập' },
  { code: 'auth:logout', name: 'Đăng xuất' },
  { code: 'auth:view_profile', name: 'Xem hồ sơ cá nhân' },
  { code: 'auth:update_profile', name: 'Cập nhật hồ sơ cá nhân' },
  { code: 'auth:manage_users', name: 'Quản lý tài khoản người dùng' },
  // shop
  { code: 'shop:view', name: 'Xem shop' },
  { code: 'shop:create', name: 'Đăng ký mở shop' },
  { code: 'shop:update_own', name: 'Cập nhật shop của mình' },
  { code: 'shop:approve', name: 'Duyệt / từ chối shop' },
  // product
  { code: 'product:view', name: 'Xem sản phẩm' },
  { code: 'product:create', name: 'Tạo sản phẩm' },
  { code: 'product:update_own', name: 'Cập nhật sản phẩm của shop mình' },
  { code: 'product:delete_own', name: 'Xóa sản phẩm của shop mình' },
  { code: 'product:moderate', name: 'Kiểm duyệt sản phẩm' },
  // order
  { code: 'order:create', name: 'Đặt hàng' },
  { code: 'order:view_own', name: 'Xem đơn hàng của mình' },
  { code: 'order:cancel_own', name: 'Hủy đơn hàng của mình' },
  { code: 'order:manage_shop', name: 'Xử lý đơn hàng của shop' },
  { code: 'order:view_all', name: 'Xem toàn bộ đơn hàng' },
  // green_eval
  { code: 'green_eval:view', name: 'Xem đánh giá xanh' },
  { code: 'green_eval:submit', name: 'Nộp chứng nhận / hồ sơ đánh giá xanh' },
  { code: 'green_eval:review', name: 'Thẩm định đánh giá xanh' },
  // admin
  { code: 'admin:view_dashboard', name: 'Xem bảng điều khiển quản trị' },
  { code: 'admin:manage_roles', name: 'Quản lý vai trò và phân quyền' },
  { code: 'admin:view_audit_log', name: 'Xem nhật ký kiểm toán' },
  { code: 'admin:manage_settings', name: 'Cấu hình hệ thống' },
];

const BASE_PERMS = ['auth:login', 'auth:logout', 'auth:view_profile', 'auth:update_profile'];
const BROWSE_PERMS = ['shop:view', 'product:view', 'green_eval:view'];

const ROLE_PERMISSIONS: Record<RoleName, string[] | 'ALL'> = {
  CUSTOMER: [
    ...BASE_PERMS,
    ...BROWSE_PERMS,
    'shop:create',
    'order:create',
    'order:view_own',
    'order:cancel_own',
  ],
  SELLER: [
    ...BASE_PERMS,
    ...BROWSE_PERMS,
    'shop:update_own',
    'product:create',
    'product:update_own',
    'product:delete_own',
    'order:create',
    'order:view_own',
    'order:cancel_own',
    'order:manage_shop',
    'green_eval:submit',
  ],
  STAFF: [
    ...BASE_PERMS,
    ...BROWSE_PERMS,
    'shop:approve',
    'product:moderate',
    'order:view_all',
    'green_eval:review',
    'admin:view_dashboard',
  ],
  ADMIN: 'ALL',
};

// Mật khẩu mẫu đều thỏa chính sách: ≥8 ký tự, hoa, thường, số, ký tự đặc biệt
const SAMPLE_USERS: {
  email: string;
  fullName: string;
  phone: string;
  password: string;
  role: RoleName;
}[] = [
  { email: 'admin@greenshopping.vn', fullName: 'Quản trị viên', phone: '0900000001', password: 'Admin@123', role: 'ADMIN' },
  { email: 'staff@greenshopping.vn', fullName: 'Nhân viên vận hành', phone: '0900000002', password: 'Staff@123', role: 'STAFF' },
  { email: 'seller@greenshopping.vn', fullName: 'Người bán mẫu', phone: '0900000003', password: 'Seller@123', role: 'SELLER' },
  { email: 'customer@greenshopping.vn', fullName: 'Khách hàng mẫu', phone: '0900000004', password: 'Customer@123', role: 'CUSTOMER' },
];

async function main(): Promise<void> {
  // 1) Roles
  const roleIds = new Map<RoleName, string>();
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roleIds.set(r.name, role.id);
  }
  console.log(`✔ ${ROLES.length} role`);

  // 2) Permissions
  const permIds = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const [resource, action] = p.code.split(':');
    const perm = await prisma.permission.upsert({
      where: { permissionCode: p.code },
      update: { name: p.name, resource, action, description: p.description ?? null },
      create: { permissionCode: p.code, name: p.name, resource, action, description: p.description ?? null },
    });
    permIds.set(p.code, perm.id);
  }
  console.log(`✔ ${PERMISSIONS.length} permission`);

  // 3) RolePermission
  let links = 0;
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS) as [RoleName, string[] | 'ALL'][]) {
    const codes = perms === 'ALL' ? [...permIds.keys()] : perms;
    const roleId = roleIds.get(roleName)!;
    for (const code of codes) {
      const permissionId = permIds.get(code);
      if (!permissionId) throw new Error(`Permission chưa khai báo: ${code}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
      links++;
    }
  }
  console.log(`✔ ${links} role_permission`);

  // 4) Tài khoản mẫu + UserRole + GreenPointAccount
  for (const u of SAMPLE_USERS) {
    const passwordHash = hashPassword(u.password, salt!);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, phone: u.phone, passwordHash, status: 'ACTIVE' },
      create: { email: u.email, fullName: u.fullName, phone: u.phone, passwordHash, status: 'ACTIVE' },
    });
    const roleId = roleIds.get(u.role)!;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });
    await prisma.greenPointAccount.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, balance: 0n },
    });
    console.log(`✔ ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error('✘ Seed thất bại:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
