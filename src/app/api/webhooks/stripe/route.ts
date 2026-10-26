import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { invalidateStorefront } from "@/lib/cache";
import { env } from "@/lib/env";
import { markOrderCancelled, markOrderPaid } from "@/server/checkout/orders";
import { stripeClient } from "@/server/checkout/stripe";

/**
 * Stripe webhook. Orders are marked paid only here, after the signature is verified
 * with STRIPE_WEBHOOK_SECRET; redirects back from Stripe are never trusted.
 */
export async function POST(request: NextRequest) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret || !env().STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments not configured" }, { status: 404 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (orderId && session.payment_status === "paid") {
          await markOrderPaid(orderId, {
            provider: "stripe",
            paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
            email: session.customer_details?.email ?? null,
            cartId: session.metadata?.cartId ?? null,
            amountTotal: session.amount_total,
          });
          invalidateStorefront();
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.orderId) await markOrderCancelled(session.metadata.orderId);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    // A 500 makes Stripe retry; processing is idempotent.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
