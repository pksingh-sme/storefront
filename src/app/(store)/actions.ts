"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { paymentsEnabled, siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { fieldErrors } from "@/lib/validation/common";
import { newsletterSchema } from "@/lib/validation/catalog";
import { addToCart, CART_COOKIE, CART_TTL_DAYS, removeCartItem, updateCartItem } from "@/server/cart";
import { createPendingOrder } from "@/server/checkout/orders";
import { stripeProvider } from "@/server/checkout/stripe";
import { ServiceError, type ActionResult } from "@/server/errors";

const CONSENT_TEXT = "I agree to receive marketing emails and can unsubscribe at any time.";

async function cartToken() {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

async function setCartCookie(token: string) {
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_TTL_DAYS * 24 * 60 * 60,
  });
}

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof ServiceError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}

export type NewsletterState = ActionResult | null;

export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  if (!(await rateLimit("newsletter"))) return { ok: false, error: "Too many attempts. Please try again in a minute." };
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
    consent: formData.get("consent") ?? undefined,
    company: formData.get("company") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };
  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email, consentText: CONSENT_TEXT, consentAt: new Date(), source: "storefront" },
    });
  } catch (error) {
    return failure(error, "We couldn't sign you up right now. Please try again.");
  }
  // Same response whether or not the address was already subscribed (no enumeration).
  return { ok: true, message: "Thank you — you're on the list." };
}

export async function addToCartAction(variantId: string, quantity: number): Promise<ActionResult<{ quantity: number }>> {
  if (!(await rateLimit("cart"))) return { ok: false, error: "Too many requests. Please slow down." };
  try {
    const result = await addToCart(await cartToken(), { variantId, quantity });
    await setCartCookie(result.token);
    return { ok: true, data: { quantity: result.quantity } };
  } catch (error) {
    return failure(error, "We couldn't add that to your bag. Please try again.");
  }
}

export async function updateCartItemAction(itemId: string, quantity: number): Promise<ActionResult> {
  if (!(await rateLimit("cart"))) return { ok: false, error: "Too many requests. Please slow down." };
  try {
    await updateCartItem(await cartToken(), { itemId, quantity });
    return { ok: true };
  } catch (error) {
    return failure(error, "We couldn't update your bag.");
  }
}

export async function removeCartItemAction(itemId: string): Promise<ActionResult> {
  try {
    await removeCartItem(await cartToken(), itemId);
    return { ok: true };
  } catch (error) {
    return failure(error, "We couldn't update your bag.");
  }
}

export type CheckoutState = { error: string } | null;

export async function startCheckout(_prev: CheckoutState): Promise<CheckoutState> {
  if (!paymentsEnabled()) return { error: "Online payment is not enabled for this store yet." };
  if (!(await rateLimit("checkout"))) return { error: "Too many attempts. Please wait a minute and try again." };
  const token = await cartToken();
  if (!token) return { error: "Your bag is empty." };
  let url: string;
  try {
    const { order, cartId } = await createPendingOrder(token);
    const session = await stripeProvider.createCheckoutSession(order, {
      successUrl: `${siteUrl()}/checkout/success`,
      cancelUrl: `${siteUrl()}/cart`,
      cartId,
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentProvider: "stripe", paymentSessionId: session.sessionId } });
    url = session.url;
  } catch (error) {
    return { error: failure(error, "We couldn't start checkout. Please try again.").error };
  }
  redirect(url);
}
