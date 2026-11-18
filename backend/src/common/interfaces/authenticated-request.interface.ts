import type { Request } from 'express';

/** Payload ký trong access token. */
export interface JwtPayload {
  sub: string; // user.user_id
  email: string;
  roles: string[];
  permissions: string[];
}

/** User gắn vào request sau khi JwtStrategy xác thực thành công. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
