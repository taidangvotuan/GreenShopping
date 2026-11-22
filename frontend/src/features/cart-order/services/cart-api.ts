import { apiRequest } from '../../../shared/lib/api-client';
import type { CartItem } from '../types';

export const cartKey = ['shopping', 'cart'] as const;
export const cartApi = {
  list: () => apiRequest<CartItem[]>('get', '/cart'),
  add: (productId: string, quantity: number) =>
    apiRequest<CartItem>('post', '/cart/items', { productId, quantity }),
  update: (id: string, quantity: number) =>
    apiRequest<CartItem>('patch', `/cart/items/${id}`, { quantity }),
  remove: (id: string) => apiRequest<{ id: string }>('delete', `/cart/items/${id}`),
};
