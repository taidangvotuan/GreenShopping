export interface Promotion {
  id: string;
  code: string;
  name: string;
  type: 'FIXED' | 'PERCENT';
  value: string;
  minSubtotal: string;
  maxDiscount: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface PromotionInput extends Omit<
  Promotion,
  'id' | 'value' | 'minSubtotal' | 'maxDiscount'
> {
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
}
