/**
 * Seed dữ liệu — IDEMPOTENT (chạy lại nhiều lần không trùng).
 * Chạy: npx -w backend prisma db seed        (thêm dữ liệu demo: đặt SEED_DEMO=true trong backend/.env)
 *
 * SECURITY (BM-04):
 * - TỪ CHỐI chạy khi NODE_ENV=production (seed chứa tài khoản mẫu có đặc quyền).
 * - Dữ liệu lõi (luôn chạy): 4 Role CUSTOMER, SELLER, STAFF, ADMIN + Permission theo miền + RolePermission.
 * - Dữ liệu demo (CHỈ khi SEED_DEMO=true): 4 tài khoản mẫu + số dư Điểm xanh, 2 cửa hàng, 3 sản phẩm,
 *   voucher GREEN50. Tài khoản mẫu đã tồn tại được GIỮ NGUYÊN (không đặt lại mật khẩu, trạng thái, vai trò).
 * - Không in mật khẩu ra stdout (mật khẩu demo ghi trong README.md, chỉ dùng cho máy phát triển).
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/common/utils/password.util';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Thiếu DATABASE_URL trong backend/.env');
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
  // SECURITY (BM-04): không bao giờ seed vào môi trường production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Từ chối chạy seed khi NODE_ENV=production.');
  }

  // ===== Dữ liệu lõi — luôn chạy =====
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

  // ===== Dữ liệu demo — chỉ khi bật tường minh =====
  if (process.env.SEED_DEMO !== 'true') {
    console.log('ℹ Bỏ qua tài khoản và dữ liệu mua sắm mẫu (đặt SEED_DEMO=true để tạo).');
    return;
  }
  await seedDemoAccounts(roleIds);
  await seedShopping();
}

/** 4) Tài khoản mẫu + UserRole + GreenPointAccount — chỉ TẠO MỚI, không ghi đè tài khoản đã có. */
async function seedDemoAccounts(roleIds: Map<RoleName, string>) {
  for (const u of SAMPLE_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (existing) {
      // Không đặt lại mật khẩu/ACTIVE/vai trò → không tái kích hoạt tài khoản mẫu đã bị khóa hay hạ quyền
      console.log(`• ${u.role.padEnd(8)} ${u.email} (đã tồn tại, giữ nguyên)`);
      continue;
    }
    await prisma.user.create({
      data: {
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        passwordHash: await hashPassword(u.password),
        status: 'ACTIVE',
        roles: { create: { roleId: roleIds.get(u.role)! } },
        greenPointAccount: { create: { balance: u.role === 'CUSTOMER' ? 1_240n : 0n } },
      },
    });
    // Không in mật khẩu ra stdout (log CI/terminal dùng chung có thể bị lưu lại)
    console.log(`✔ ${u.role.padEnd(8)} ${u.email}`);
  }
}

async function seedShopping() {
  const seller = await prisma.user.findUniqueOrThrow({ where: { email: 'seller@greenshopping.vn' } });
  const moc = '528688d8-031b-4a21-8158-0e18a4746bc9';
  const tre = '5c25d5f2-d5dc-4f51-bd8c-391954fea1a5';
  for (const shop of [{ id: moc, name: 'Mộc Living', shippingFee: 30_000 }, { id: tre, name: 'Tre Việt', shippingFee: 25_000 }]) {
    await prisma.shop.upsert({ where: { id: shop.id }, create: { ...shop, ownerId: seller.id }, update: {} });
  }
  const products = [
    { id: '1f6cf027-8a54-498a-89e9-f0fdc6e4b236', shopId: moc, name: 'Bình giữ nhiệt inox 500ml',
      description: 'Bình inox dung tích 500ml, màu xanh sage. Phù hợp để mang theo khi đi làm, đi học hoặc đi chơi.',
      price: 289_000, imageUrl: '/shopping/bottle.png',
      imageGallery: ['/shopping/bottle-detail.png', '/shopping/bottle-side.png', '/shopping/bottle-cap.png'] },
    { id: 'e7c62b9d-21db-4d9c-a473-5a44aeb51ff5', shopId: moc, name: 'Túi tote cotton hữu cơ',
      description: 'Túi vải cotton màu tự nhiên, kích thước 38 × 42 cm, có thể dùng nhiều lần.',
      price: 129_000, imageUrl: '/shopping/tote.png' },
    { id: '72d87153-4370-442a-a2d1-7adcabeb1de0', shopId: tre, name: 'Bộ 4 bàn chải tre',
      description: 'Bộ bốn bàn chải cán tre, lông mềm.',
      price: 89_000, imageUrl: '/shopping/toothbrush.png' },
  ];
  for (const product of products) {
    await prisma.product.upsert({ where: { id: product.id }, create: { ...product, stock: 50 }, update: {} });
  }
  await prisma.promotion.upsert({
    where: { code: 'GREEN50' }, update: {},
    create: {
      code: 'GREEN50', name: 'Giảm 50.000 ₫ cho đơn từ 500.000 ₫', type: 'FIXED', value: 50_000,
      minSubtotal: 500_000, startsAt: new Date('2026-01-01T00:00:00.000Z'), endsAt: new Date('2030-01-01T00:00:00.000Z'),
    },
  });
}

main()
  .catch((e) => {
    console.error('✘ Seed thất bại:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
