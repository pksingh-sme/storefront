import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import type { CheckoutOrder, PaymentProvider } from "./types";

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  client ??= new Stripe(key);
  return client;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCheckoutSession(order: CheckoutOrder, opts) {
    const currency = order.currency.toLowerCase();
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency,
        unit_amount: item.unitPriceCents,
        product_data: { name: `${item.productName} — ${item.variantName}`, metadata: { sku: item.sku } },
      },
    }));
    if (order.shippingCents > 0) {
      lineItems.push({ quantity: 1, price_data: { currency, unit_amount: order.shippingCents, product_data: { name: "Shipping" } } });
    }
    if (order.taxCents > 0) {
      lineItems.push({ quantity: 1, price_data: { currency, unit_amount: order.taxCents, product_data: { name: "Tax" } } });
    }
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${opts.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: opts.cancelUrl,
      client_reference_id: order.id,
      metadata: { orderId: order.id, cartId: opts.cartId },
      shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "AU", "IN", "DE", "FR"] },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { sessionId: session.id, url: session.url };
  },
};
