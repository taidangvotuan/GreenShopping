import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ApiErrorResponse, ApiSuccessResponse } from '../types/api-response.types';
import { buildLoginUrl } from './route-permissions';
import { tokenStorage } from './token-storage';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Request mà 401 mang nghĩa "sai thông tin" chứ không phải "hết phiên". */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => error.config?.url?.endsWith(p));
    if (error.response?.status === 401 && !isAuthEndpoint && typeof window !== 'undefined') {
      // Token hết hạn / bị thu hồi → xóa cookie và về trang đăng nhập, giữ lại đích cũ
      tokenStorage.clear();
      const { pathname, search } = window.location;
      if (pathname !== '/login') {
        window.location.assign(buildLoginUrl(`${pathname}${search}`));
      }
    }
    return Promise.reject(error);
  },
);

/** Gọi API và trả về trường `data` đã bóc khỏi envelope. */
export async function apiRequest<T>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await apiClient.request<ApiSuccessResponse<T>>({ method, url, data: body });
  return res.data.data;
}

/** Lấy thông điệp lỗi thân thiện từ lỗi API bất kỳ. */
export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi, vui lòng thử lại'): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    if (!error.response) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng';
    const { message, errors } = error.response.data ?? {};
    if (errors?.length) return errors[0];
    if (message) return message;
  }
  return fallback;
}
