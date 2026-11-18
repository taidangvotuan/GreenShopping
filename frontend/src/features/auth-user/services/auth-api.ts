import { apiRequest } from '../../../shared/lib/api-client';
import type { AuthUser, LoginPayload, LoginResponse, RegisterPayload } from '../types';

export const authApi = {
  register: (payload: RegisterPayload) => apiRequest<AuthUser>('post', '/auth/register', payload),

  login: (payload: LoginPayload) => apiRequest<LoginResponse>('post', '/auth/login', payload),

  logout: () => apiRequest<{ loggedOut: boolean }>('post', '/auth/logout'),

  me: () => apiRequest<AuthUser>('get', '/auth/me'),
};
