import "server-only";
import { randomBytes } from "node:crypto";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { resolveVariantPrice } from "@/lib/pricing";
import { ServiceError } from "../errors";
import { recomputeProductAggregates } from "../products";
import { computeTotals } from "./totals";

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Creates a PENDING order from the visitor's cart, re-validating availability, stock
 * and prices on the server. Stock is reserved only when payment is confirmed.
 */
export async function createPendingOrder(cartToken: string) {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { token: cartToken },
      include: { items: { include: { variant: { include: { product: { include: { category: { select: { isActive: true } } } } } } } } },
    });
    if (!cart || cart.items.length === 0) throw new ServiceError("Your bag is empty.");
    const settings = await tx.storeSettings.upsert({ where: { id: "store" }, update: {}, create: { id: "store" } });

    const lines = cart.items.map((item) => {
      const v = item.variant;
      const p = v.product;
      if (p.status !== "PUBLISHED" || !p.category.isActive || !v.isActive) {
        throw new ServiceError(`${p.name} (${v.colorName}) is no longer available. Remove it to continue.`);
      }
      if (item.quantity > v.stock) {
        throw new ServiceError(`Only ${v.stock} of ${p.name} (${v.colorName}) available. Update your bag to continue.`);
      }
      if (p.currency !== settings.currency) throw new ServiceError("Your bag contains items in another currency.");
      const price = resolveVariantPrice(p, v);
      return {
        variantId: v.id,
        productName: p.name,
        variantName: v.colorName,
        sku: v.sku,
        unitPriceCents: price.unitCents,
        quantity: item.quantity,
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
    const totals = computeTotals(subtotal, settings);
    const order = await tx.order.create({
      data: {
        number: orderNumber(),
        status: "PENDING",
        currency: settings.currency,
        ...totals,
        items: { create: lines },
      },
      include: { items: true },
    });
    return { order, cartId: cart.id };
  });
}

/**
 * Marks an order paid after a verified payment webhook. Idempotent: replays of the same
 * event do nothing. Stock is decremented atomically; if a variant sold out in the
 * meantime the order is flagged in the audit log for manual follow-up.
 */
export async function markOrderPaid(orderId: string, payment: { provider: string; paymentIntentId?: string | null; email?: string | null; cartId?: string | null; amountTotal?: number | null }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== "PENDING") return { order, alreadyProcessed: true, oversold: [] as string[] };
    if (payment.amountTotal != null && payment.amountTotal !== order.totalCents) {
      await audit(tx, null, "order.amount_mismatch", "Order", order.id, { expected: order.totalCents, received: payment.amountTotal });
    }

    const oversold: string[] = [];
    const productIds = new Set<string>();
    for (const item of order.items) {
      if (!item.variantId) continue;
      const res = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (res.count === 0) oversold.push(item.sku);
      const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { productId: true } });
      if (variant) productIds.add(variant.productId);
    }
    for (const id of productIds) await recomputeProductAggregates(tx, id);

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentProvider: payment.provider,
        paymentIntentId: payment.paymentIntentId ?? null,
        email: payment.email ?? order.email,
      },
    });
    if (payment.cartId) await tx.cartItem.deleteMany({ where: { cartId: payment.cartId } });
    await audit(tx, null, "order.paid", "Order", order.id, { oversold });
    return { order: updated, alreadyProcessed: false, oversold };
  });
}

export async function markOrderCancelled(orderId: string) {
  await prisma.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
}
