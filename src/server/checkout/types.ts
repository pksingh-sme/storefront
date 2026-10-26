export type CheckoutOrder = {
  id: string;
  number: string;
  currency: string;
  shippingCents: number;
  taxCents: number;
  items: { productName: string; variantName: string; sku: string; unitPriceCents: number; quantity: number }[];
};

/**
 * Integration point for payment providers. A provider creates a hosted payment page for
 * a pending order; the order is only marked paid from a verified server-side webhook.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(
    order: CheckoutOrder,
    opts: { successUrl: string; cancelUrl: string; cartId: string },
  ): Promise<{ sessionId: string; url: string }>;
}
