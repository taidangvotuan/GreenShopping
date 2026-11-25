import type { Request } from 'express';

/** Payload ký trong access token. */
export interface JwtPayload {
  sub: string; // user.user_id
  /** BM-03: định danh phiên (UUID) — logout ghi jti vào bảng revoked_token để thu hồi token. */
  jti: string;
  email: string;
  /** Chỉ để FE điều hướng; quyền thật được JwtStrategy đọc lại từ CSDL ở mỗi request. */
  roles: string[];
  permissions: string[];
  /** Do thư viện JWT tự thêm khi ký (giây kể từ epoch). */
  iat?: number;
  exp?: number;
}

/** User gắn vào request sau khi JwtStrategy xác thực thành công. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  /** jti của access token đang dùng (để thu hồi khi logout). */
  jti: string;
  /** Thời điểm access token hết hạn — bản ghi thu hồi chỉ cần giữ tới mốc này. */
  tokenExpiresAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
