import type { RoleName } from '../../shared/lib/route-permissions';

export type { RoleName };
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING';

/** Khớp AuthUserDto của backend (không bao giờ có password_hash). */
export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  roles: RoleName[];
  permissions: string[];
  createdAt: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: string;
  user: AuthUser;
}

/** Body gửi lên POST /auth/register (không gồm confirmPassword). */
export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}
