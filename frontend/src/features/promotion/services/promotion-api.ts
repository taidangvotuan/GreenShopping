import { apiRequest } from '../../../shared/lib/api-client';
import type { Promotion, PromotionInput } from '../types';

export const promotionApi = {
  list: () => apiRequest<Promotion[]>('get', '/promotions'),
  manage: () => apiRequest<Promotion[]>('get', '/promotions/manage'),
  save: (input: PromotionInput, id?: string) =>
    apiRequest<Promotion>(id ? 'put' : 'post', id ? `/promotions/${id}` : '/promotions', input),
};
