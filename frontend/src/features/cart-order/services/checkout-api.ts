import { apiRequest } from '../../../shared/lib/api-client';
import type { CheckoutInput, Quote, QuoteInput, SavedAddress } from '../types';

export const quoteKey = ['shopping', 'quote'] as const;
export const checkoutApi = {
  quote: (input: QuoteInput) => apiRequest<Quote>('post', '/checkout/quote', input),
  place: (input: CheckoutInput) => apiRequest<{ id: string }>('post', '/checkout', input),
  addresses: () => apiRequest<SavedAddress[]>('get', '/checkout/addresses'),
};
