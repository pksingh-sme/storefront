import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  // Order status comes from our database (updated by the verified webhook), never from the URL.
  const order =
    typeof session_id === "string" && session_id.length < 300
      ? await prisma.order.findUnique({ where: { paymentSessionId: session_id }, select: { number: true, status: true, totalCents: true, currency: true } })
      : null;

  return (
    <div className="container-page max-w-2xl py-20 text-center">
      <p className="eyebrow text-gold-deep">Thank you</p>
      <h1 className="mt-3 text-4xl sm:text-5xl">{order?.status === "PAID" ? "Your order is confirmed" : "We're confirming your payment"}</h1>
      {order ? (
        <p className="mt-5 text-stone">
          Order <strong className="text-charcoal">{order.number}</strong> · {formatMoney(order.totalCents, order.currency)}
          {order.status !== "PAID" ? " — this page will show confirmation once the payment provider notifies us. You'll also receive an email receipt from the payment provider." : null}
        </p>
      ) : (
        <p className="mt-5 text-stone">If you completed payment, you will receive a receipt by email.</p>
      )}
      <Link href="/shop" className="mt-10 inline-block border-b border-charcoal pb-0.5 text-sm">
        Continue shopping
      </Link>
    </div>
  );
}
