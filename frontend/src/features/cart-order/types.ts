import type { Product } from '../shop-product/types';

export type PaymentMethod = 'MOCK' | 'COD';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export type OrderStatus =
  'AWAITING_PAYMENT' | 'PROCESSING' | 'SHIPPING' | 'DELIVERY_ISSUE' | 'COMPLETED' | 'CANCELLED';
export type ShipmentStatus =
  | 'AWAITING_PAYMENT'
  | 'PROCESSING'
  | 'READY'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';
export type MockOutcome = Extract<PaymentStatus, 'SUCCEEDED' | 'FAILED' | 'CANCELLED'>;

export interface CartItem {
  id: string;
  quantity: number;
  revision: number;
  product: Product;
}

export interface Discounts {
  voucherCode?: string;
  points?: number;
}

export interface QuoteInput extends Discounts {
  cartItemIds?: string[];
  buyNow?: { productId: string; quantity: number };
}

export interface Totals {
  subtotal: number | string;
  shippingFee: number | string;
  voucherDiscount: number | string;
  pointDiscount: number | string;
  grandTotal: number | string;
}

export interface Quote extends Totals {
  grandTotal: number;
  voucherCode: string | null;
  promotionError: string | null;
  pointsError: string | null;
  pointBalance: string;
  pointLimit: number;
  pointValue: number;
  pointsUsed: number;
  shops: (Totals & {
    shopId: string;
    shopName: string;
    items: {
      productId: string;
      name: string;
      imageUrl: string | null;
      quantity: number;
      unitPrice: number;
    }[];
  })[];
}

export interface DeliveryAddress {
  recipientName: string;
  phone: string;
  province: string;
  ward: string;
  addressLine: string;
}

export interface SavedAddress extends DeliveryAddress {
  id: string;
  isDefault: boolean;
}

export interface CheckoutInput extends QuoteInput {
  requestId: string;
  expectedTotal: number;
  address: DeliveryAddress;
  paymentMethod: PaymentMethod;
  ecoShopIds: string[];
}

export interface PaymentSummary {
  method: PaymentMethod;
  status: PaymentStatus;
  expiresAt: string | null;
  resolvedAt: string | null;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  grandTotal: string;
  createdAt: string;
  payment: PaymentSummary;
  subOrders: {
    id: string;
    shopName: string;
    status: ShipmentStatus;
    items: { productName: string; quantity: number }[];
  }[];
}

export interface ShipmentEvent {
  id: number;
  status: ShipmentStatus;
  note: string | null;
  createdAt: string;
}

export interface SubOrder extends Totals {
  id: string;
  shopName: string;
  status: ShipmentStatus;
  ecoPackaging: boolean;
  shipment: { trackingCode: string } | null;
  history: ShipmentEvent[];
  items: {
    id: string;
    productId: string;
    productName: string;
    imageUrl: string | null;
    unitPrice: string;
    quantity: number;
    sourceCartItemId: string | null;
  }[];
}

export interface MasterOrder
  extends DeliveryAddress, Totals, Omit<OrderSummary, 'subOrders' | 'grandTotal'> {
  pointsUsed: number;
  voucherCode: string | null;
  serverTime: string;
  updatedAt: string;
  subOrders: SubOrder[];
}

export interface PageResult<T> {
  items: T[];
  total: number;
  pageSize: number;
}

export interface ManagedPayment extends PaymentSummary {
  id: string;
  amount: string;
  createdAt: string;
  masterOrder: { id: string; recipientName: string; status: OrderStatus };
  events: { id: number; status: PaymentStatus; createdAt: string }[];
}

export interface ManagedShipment extends Pick<
  SubOrder,
  'id' | 'shopName' | 'status' | 'shipment' | 'history' | 'ecoPackaging'
> {
  grandTotal: string;
  updatedAt: string;
  masterOrder: DeliveryAddress & { id: string; payment: { method: PaymentMethod } };
  items: { productName: string; quantity: number }[];
}
