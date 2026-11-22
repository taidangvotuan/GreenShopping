import { apiRequest } from '../../../shared/lib/api-client';
import type { Product } from '../types';

export const productApi = {
  list: () => apiRequest<Product[]>('get', '/products'),
  get: (id: string) => apiRequest<Product>('get', `/products/${id}`),
};
