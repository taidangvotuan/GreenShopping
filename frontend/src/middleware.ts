import { decodeJwt } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_PAGES,
  buildLoginUrl,
  findProtectedRoute,
  getHomeForRoles,
  getPostLoginRedirect,
  hasAnyRole,
} from './shared/lib/route-permissions';
import { ACCESS_TOKEN_COOKIE, ROLES_COOKIE } from './shared/lib/token-storage';

/**
 * Bảo vệ route ở tầng Edge trước khi render:
 *  - Guest vào route cần đăng nhập → /login?redirect=<path>
 *  - Đã đăng nhập vào /login, /register → trang chủ theo role
 *  - Sai role (CUSTOMER → /seller, /admin; SELLER → /admin) → trang chủ theo role
 *
 * Middleware KHÔNG có JWT secret nên chỉ GIẢI MÃ (không xác minh chữ ký) để lấy roles/exp.
 * Cookie có thể bị sửa tay → đây chỉ là lớp UX; backend mới là nơi kiểm quyền thật (401/403).
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = readSession(request);

  // 1) Trang đăng nhập/đăng ký: đã đăng nhập thì chuyển đi
  if (AUTH_PAGES.includes(pathname)) {
    if (!session) return NextResponse.next();
    const target = getPostLoginRedirect(session.roles, request.nextUrl.searchParams.get('redirect'));
    return NextResponse.redirect(new URL(target, request.url));
  }

  const rule = findProtectedRoute(pathname);
  if (!rule) return NextResponse.next(); // route công khai (/, /products/**, ...)

  // 2) Route cần đăng nhập
  if (!session) {
    const res = NextResponse.redirect(new URL(buildLoginUrl(`${pathname}${search}`), request.url));
    // Token hết hạn/hỏng → dọn cookie
    if (request.cookies.has(ACCESS_TOKEN_COOKIE)) {
      res.cookies.delete(ACCESS_TOKEN_COOKIE);
      res.cookies.delete(ROLES_COOKIE);
    }
    return res;
  }

  // 3) RBAC theo role
  if (!hasAnyRole(session.roles, rule.roles)) {
    return NextResponse.redirect(new URL(getHomeForRoles(session.roles), request.url));
  }

  return NextResponse.next();
}

function readSession(request: NextRequest): { roles: string[] } | null {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = decodeJwt(token);
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) return null;
    // Ưu tiên roles trong JWT; cookie gs_roles chỉ là dự phòng
    const roles = Array.isArray(payload.roles)
      ? (payload.roles as unknown[]).filter((r): r is string => typeof r === 'string')
      : (request.cookies.get(ROLES_COOKIE)?.value ?? '').split(',').filter(Boolean);
    return { roles };
  } catch {
    return null;
  }
}

export const config = {
  // Bỏ qua static assets, ảnh, favicon và các route API nội bộ của Next
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js)$).*)'],
};
