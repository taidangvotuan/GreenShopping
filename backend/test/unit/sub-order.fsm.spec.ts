import type { SubOrderStatus } from '../../src/generated/prisma/client';
import {
  rollUpOrder,
  shipmentTransitions,
} from '../../src/modules/cart-order/sub-orders/sub-order.fsm';

describe('shipmentTransitions — các mốc giao hàng hợp lệ', () => {
  it.each<[SubOrderStatus, SubOrderStatus[]]>([
    ['PROCESSING', ['READY']],
    ['READY', ['IN_TRANSIT']],
    ['IN_TRANSIT', ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED']],
    ['OUT_FOR_DELIVERY', ['DELIVERED', 'DELIVERY_FAILED']],
    ['DELIVERY_FAILED', ['IN_TRANSIT']],
  ])('%s → %j', (from, to) => {
    expect(shipmentTransitions[from]).toEqual(to);
  });

  it.each<SubOrderStatus>(['AWAITING_PAYMENT', 'DELIVERED', 'CANCELLED'])(
    '%s không có bước chuyển nào (chưa thanh toán hoặc đã kết thúc)',
    (status) => {
      expect(shipmentTransitions[status]).toEqual([]);
    },
  );

  it('không cho nhảy cóc từ PROCESSING sang DELIVERED', () => {
    expect(shipmentTransitions.PROCESSING).not.toContain('DELIVERED');
  });
});

describe('rollUpOrder — trạng thái đơn tổng từ các đơn con', () => {
  it.each<[SubOrderStatus[], string]>([
    [['DELIVERED', 'DELIVERED'], 'COMPLETED'],
    [['DELIVERED', 'DELIVERY_FAILED'], 'DELIVERY_ISSUE'],
    [['DELIVERED', 'PROCESSING'], 'SHIPPING'],
    [['IN_TRANSIT', 'READY'], 'SHIPPING'],
    [['PROCESSING', 'READY'], 'PROCESSING'],
    [[], 'PROCESSING'],
  ])('%j → %s', (statuses, expected) => {
    expect(rollUpOrder(statuses)).toBe(expected);
  });
});
