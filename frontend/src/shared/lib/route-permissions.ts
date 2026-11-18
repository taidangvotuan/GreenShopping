/**
 * Quy tắc phân quyền route — dùng chung cho middleware.ts (Edge) và RoleGuard (client).
 * Hàm thuần, không phụ thuộc DOM/Node để chạy được ở cả hai môi trường.
 */
export type RoleName = 'CUSTOMER' | 'SELLER' | 'STAFF' | 'ADMIN';

/** Thứ tự ưu tiên khi user có nhiều role. */
export const ROLE_PRIORITY: RoleName[] = ['ADMIN', 'STAFF', 'SELLER', 'CUSTOMER'];

export const LOGIN_PATH = '/login';
export const REGISTER_PATH = '/register';
export const AUTH_PAGES = [LOGIN_PATH, REGISTER_PATH];

/** Khách (chưa đăng nhập) được vào. `/**` = cả route con. */
export const PUBLIC_ROUTES = [
  '/',
  LOGIN_PATH,
  REGISTER_PATH,
  '/products/**',
  '/categories/**',
  '/shops/**',
  '/promotions',
];

/** Route yêu cầu đăng nhập; `roles` rỗng = mọi role đã đăng nhập. Khớp theo thứ tự. */
export const PROTECTED_ROUTES: { pattern: string; roles: RoleName[] }[] = [
  { pattern: '/admin/**', roles: ['ADMIN', 'STAFF'] },
  { pattern: '/seller/**', roles: ['SELLER', 'ADMIN'] },
  { pattern: '/cart', roles: [] },
  { pattern: '/checkout/**', roles: [] },
  { pattern: '/orders/**', roles: [] },
  { pattern: '/account/**', roles: [] },
];

/** `/x/**` khớp `/x` và mọi `/x/...`; mẫu khác khớp chính xác. */
export function matchRoute(pathname: string, pattern: string): boolean {
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return pathname === pattern;
}

export const isPublicRoute = (pathname: string) =>
  PUBLIC_ROUTES.some((p) => matchRoute(pathname, p));

export const findProtectedRoute = (pathname: string) =>
  PROTECTED_ROUTES.find((r) => matchRoute(pathname, r.pattern));

export function hasAnyRole(userRoles: readonly string[], required: readonly RoleName[]): boolean {
  return required.length === 0 || userRoles.some((r) => required.includes(r as RoleName));
}

/** User (đã đăng nhập) có được vào pathname không. */
export function canAccess(pathname: string, userRoles: readonly string[]): boolean {
  const rule = findProtectedRoute(pathname);
  return !rule || hasAnyRole(userRoles, rule.roles);
}

/** Role cao nhất theo ADMIN > STAFF > SELLER > CUSTOMER. */
export function getPrimaryRole(roles: readonly string[]): RoleName | null {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
}

/** Trang chủ theo role sau đăng nhập. */
export function getHomeForRoles(roles: readonly string[]): string {
  switch (getPrimaryRole(roles)) {
    case 'ADMIN':
    case 'STAFF':
      return '/admin/dashboard';
    case 'SELLER':
      return '/seller/dashboard';
    default:
      return '/';
  }
}

/**
 * Chống Open Redirect: chỉ chấp nhận đường dẫn NỘI BỘ dạng "/abc".
 * Loại bỏ "//evil.com", "/\\evil.com", "http://...", ký tự điều khiển.
 */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, 'http://internal.local');
    if (url.origin !== 'http://internal.local') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Đích sau đăng nhập: `redirect` nội bộ hợp lệ & đủ quyền, nếu không → trang theo role. */
export function getPostLoginRedirect(roles: readonly string[], redirect?: string | null): string {
  const safe = sanitizeRedirect(redirect);
  if (safe) {
    const pathname = safe.split(/[?#]/)[0];
    if (!AUTH_PAGES.includes(pathname) && canAccess(pathname, roles)) return safe;
  }
  return getHomeForRoles(roles);
}

export function buildLoginUrl(redirectPath?: string): string {
  const safe = sanitizeRedirect(redirectPath);
  return safe && safe !== '/' ? `${LOGIN_PATH}?redirect=${encodeURIComponent(safe)}` : LOGIN_PATH;
}
