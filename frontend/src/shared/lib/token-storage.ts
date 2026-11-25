/**
 * Lưu access token + roles trong COOKIE để Edge Middleware (server) đọc được khi điều hướng.
 *
 * Lưu ý bảo mật: cookie đặt từ JavaScript không thể là HttpOnly → vẫn đọc được bởi JS.
 * Giảm thiểu: SameSite=Lax (chống CSRF điều hướng chéo), Secure khi chạy HTTPS, hạn = hạn JWT
 * (access token ngắn hạn, mặc định 30 phút), logout gọi API để backend THU HỒI token (revoked_token).
 * Quyền thật sự luôn được backend kiểm tra (JwtAuthGuard + RolesGuard); middleware chỉ để UX.
 * Chuyển sang cookie HttpOnly do backend phát hành là hạng mục riêng (xem FIX_P0_REPORT.md).
 */
export const ACCESS_TOKEN_COOKIE = 'gs_access_token';
export const ROLES_COOKIE = 'gs_roles';

/** Chỉ dùng khi không đọc được claim exp — khớp JWT_ACCESS_EXPIRES_IN mặc định (30m). */
const DEFAULT_MAX_AGE = 30 * 60;

const isBrowser = () => typeof document !== 'undefined';

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (!isBrowser()) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}

function deleteCookie(name: string): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Thời gian sống còn lại của JWT (giây), dựa trên claim exp. */
function remainingLifetime(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number') {
      return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    }
  } catch {
    /* token không đúng định dạng → dùng mặc định */
  }
  return DEFAULT_MAX_AGE;
}

export const tokenStorage = {
  getAccessToken: (): string | null => getCookie(ACCESS_TOKEN_COOKIE),

  getRoles: (): string[] => {
    const raw = getCookie(ROLES_COOKIE);
    return raw ? raw.split(',').filter(Boolean) : [];
  },

  setSession(accessToken: string, roles: string[]): void {
    const maxAge = remainingLifetime(accessToken);
    setCookie(ACCESS_TOKEN_COOKIE, accessToken, maxAge);
    setCookie(ROLES_COOKIE, roles.join(','), maxAge);
  },

  clear(): void {
    deleteCookie(ACCESS_TOKEN_COOKIE);
    deleteCookie(ROLES_COOKIE);
  },
};
