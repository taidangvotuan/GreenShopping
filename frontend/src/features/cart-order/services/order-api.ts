import { apiRequest } from '../../../shared/lib/api-client';
import type { MasterOrder, OrderSummary, PageResult } from '../types';

export const ordersKey = ['shopping', 'orders'] as const;
export const orderApi = {
  list: (page: number) => apiRequest<PageResult<OrderSummary>>('get', `/orders?page=${page}`),
  get: (id: string) => apiRequest<MasterOrder>('get', `/orders/${id}`),
};
