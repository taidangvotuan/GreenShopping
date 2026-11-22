import { apiRequest } from '../../../shared/lib/api-client';
import type {
  ManagedPayment,
  MockOutcome,
  PageResult,
  PaymentStatus,
  PaymentSummary,
} from '../../cart-order/types';

export const paymentApi = {
  resolve: (id: string, outcome: MockOutcome) =>
    apiRequest<PaymentSummary>('post', `/payments/${id}/mock-result`, { outcome }),
  manage: (page: number, status: PaymentStatus | '') =>
    apiRequest<PageResult<ManagedPayment>>(
      'get',
      `/payments/manage?page=${page}${status ? `&status=${status}` : ''}`,
    ),
};
