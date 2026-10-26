import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { CartLines } from "@/components/store/cart-lines";
import { CheckoutButton } from "@/components/store/checkout-button";
import { ButtonLink } from "@/components/ui/button";
import { paymentsEnabled } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { CART_COOKIE, getCartView } from "@/server/cart";
import { getSettings } from "@/server/catalog";
import { computeTotals } from "@/server/checkout/totals";

export const metadata: Metadata = { title: "Shopping bag", robots: { index: false } };

export default async function CartPage() {
  const settings = await getSettings();
  const token = (await cookies()).get(CART_COOKIE)?.value;
  const cart = await getCartView(token, settings.currency);
  const totals = computeTotals(cart.subtotalCents, settings);
  const payments = paymentsEnabled();

  return (
    <div className="container-page py-10 lg:py-14">
      <h1 className="text-4xl sm:text-5xl">Shopping bag</h1>
      {cart.lines.length === 0 ? (
        <div className="mt-10 border border-dashed border-line px-6 py-20 text-center" data-testid="empty-cart">
          <p className="font-display text-2xl">Your bag is empty</p>
          <p className="mt-2 text-sm text-stone">Discover something you love.</p>
          <ButtonLink href="/shop" className="mt-8">
            Continue shopping
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <CartLines lines={cart.lines} currency={cart.currency} />
          </div>
          <aside aria-labelledby="summary-title" className="h-fit bg-cream p-6 lg:col-span-4 lg:sticky lg:top-28">
            <h2 id="summary-title" className="text-2xl">
              Order summary
            </h2>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd data-testid="cart-subtotal">{formatMoney(totals.subtotalCents, cart.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
                <dd>{totals.shippingCents === 0 ? "Free" : formatMoney(totals.shippingCents, cart.currency)}</dd>
              </div>
              {totals.taxCents > 0 ? (
                <div className="flex justify-between">
                  <dt>Estimated tax</dt>
                  <dd>{formatMoney(totals.taxCents, cart.currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
                <dt>Total</dt>
                <dd>{formatMoney(totals.totalCents, cart.currency)}</dd>
              </div>
            </dl>
            {settings.freeShippingThresholdCents && totals.shippingCents > 0 ? (
              <p className="mt-4 text-xs text-stone">
                Spend {formatMoney(settings.freeShippingThresholdCents - totals.subtotalCents, cart.currency)} more for free shipping.
              </p>
            ) : null}
            <div className="mt-6">
              {cart.hasIssues ? (
                <p className="mb-3 text-sm text-danger" role="alert">
                  Some items need attention before you can check out.
                </p>
              ) : null}
              {payments ? (
                <CheckoutButton disabled={cart.hasIssues || cart.subtotalCents === 0} />
              ) : (
                <div className="border border-line bg-ivory p-4 text-sm text-stone" data-testid="checkout-unavailable">
                  Online checkout isn&apos;t available yet.
                  {settings.contactEmail ? (
                    <>
                      {" "}
                      To order, email{" "}
                      <a href={`mailto:${settings.contactEmail}`} className="underline underline-offset-4">
                        {settings.contactEmail}
                      </a>
                      .
                    </>
                  ) : null}
                </div>
              )}
            </div>
            <Link href="/shop" className="mt-5 block text-center text-sm underline underline-offset-4">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
