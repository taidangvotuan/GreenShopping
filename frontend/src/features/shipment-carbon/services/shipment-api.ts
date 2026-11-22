import { apiRequest } from '../../../shared/lib/api-client';
import type { ManagedShipment, PageResult, ShipmentStatus } from '../../cart-order/types';

export const shipmentApi = {
  manage: (page: number, status: ShipmentStatus | '') =>
    apiRequest<PageResult<ManagedShipment>>(
      'get',
      `/shipments?page=${page}${status ? `&status=${status}` : ''}`,
    ),
  update: (id: string, expectedStatus: ShipmentStatus, status: ShipmentStatus, note?: string) =>
    apiRequest<ManagedShipment>('patch', `/shipments/${id}/status`, {
      expectedStatus,
      status,
      note,
    }),
};
