import type { MasterOrderStatus, SubOrderStatus } from '../../../generated/prisma/client';

export const shipmentTransitions: Record<SubOrderStatus, SubOrderStatus[]> = {
  AWAITING_PAYMENT: [],
  PROCESSING: ['READY'],
  READY: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED: ['IN_TRANSIT'],
  DELIVERED: [],
  CANCELLED: [],
};

export function rollUpOrder(statuses: SubOrderStatus[]): MasterOrderStatus {
  if (statuses.length && statuses.every((status) => status === 'DELIVERED')) return 'COMPLETED';
  if (statuses.includes('DELIVERY_FAILED')) return 'DELIVERY_ISSUE';
  if (statuses.some((status) => ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status))) {
    return 'SHIPPING';
  }
  return 'PROCESSING';
}
