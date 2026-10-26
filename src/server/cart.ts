import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { resolveVariantPrice } from "@/lib/pricing";
import { cartAddSchema, cartUpdateSchema } from "@/lib/validation/catalog";
import { toImageDTO } from "./dto";
import { ServiceError } from "./errors";

export const CART_COOKIE = "sf_cart";
export const CART_TTL_DAYS = 30;

export function newCartToken() {
  return randomBytes(32).toString("base64url");
}

function expiry() {
  return new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);
}

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              currency: true,
              basePriceCents: true,
              salePriceCents: true,
              category: { select: { isActive: true } },
              images: {
                where: { status: "READY" as const },
                orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
              },
            },
          },
        },
      },
    },
  },
};

export type CartLine = {
  id: string;
  variantId: string;
  productName: string;
  productSlug: string;
  colorName: string;
  colorHex: string | null;
  sku: string;
  unitCents: number;
  regularCents: number;
  quantity: number;
  lineCents: number;
  stock: number;
  /** Set when the line cannot be purchased as-is. */
  issue: string | null;
  image: { src: string; alt: string } | null;
};

export type CartView = {
  lines: CartLine[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
  hasIssues: boolean;
};

export const EMPTY_CART: CartView = { lines: [], itemCount: 0, subtotalCents: 0, currency: "USD", hasIssues: false };

/** Builds the cart from current database prices and stock. Client-supplied prices are never used. */
export async function getCartView(token: string | undefined | null, currency = "USD"): Promise<CartView> {
  if (!token) return { ...EMPTY_CART, currency };
  const cart = await prisma.cart.findUnique({ where: { token }, include: cartInclude });
  if (!cart || cart.expiresAt < new Date()) return { ...EMPTY_CART, currency };

  const lines: CartLine[] = cart.items.map((item) => {
    const v = item.variant;
    const p = v.product;
    const price = resolveVariantPrice(p, v);
    let issue: string | null = null;
    if (p.status !== "PUBLISHED" || !p.category.isActive || !v.isActive) issue = "No longer available";
    else if (v.stock <= 0) issue = "Out of stock";
    else if (item.quantity > v.stock) issue = `Only ${v.stock} left`;
    const img = p.images.find((i) => i.variantId === v.id) ?? p.images.find((i) => i.variantId === null);
    const dto = img ? toImageDTO(img, `${p.name} in ${v.colorName}`) : null;
    return {
      id: item.id,
      variantId: v.id,
      productName: p.name,
      productSlug: p.slug,
      colorName: v.colorName,
      colorHex: v.colorHex,
      sku: v.sku,
      unitCents: price.unitCents,
      regularCents: price.regularCents,
      quantity: item.quantity,
      lineCents: price.unitCents * item.quantity,
      stock: v.stock,
      issue,
      image: dto ? { src: dto.thumbSrc, alt: dto.alt } : null,
    };
  });

  const purchasable = lines.filter((l) => !l.issue);
  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: purchasable.reduce((sum, l) => sum + l.lineCents, 0),
    currency: cart.items[0]?.variant.product.currency ?? currency,
    hasIssues: lines.some((l) => l.issue),
  };
}

export async function getCartCount(token: string | undefined | null): Promise<number> {
  if (!token) return 0;
  const result = await prisma.cartItem.aggregate({ where: { cart: { token, expiresAt: { gt: new Date() } } }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}

async function loadPurchasableVariant(variantId: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { status: true, category: { select: { isActive: true } } } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== "PUBLISHED" || !variant.product.category.isActive) {
    throw new ServiceError("This item is no longer available.");
  }
  return variant;
}

/** Adds a variant to the cart, creating the cart if needed. Returns the cart token. */
export async function addToCart(token: string | null | undefined, input: unknown): Promise<{ token: string; quantity: number }> {
  const parsed = cartAddSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Invalid item or quantity.");
  const { variantId, quantity } = parsed.data;
  const variant = await loadPurchasableVariant(variantId);
  if (variant.stock <= 0) throw new ServiceError(`${variant.colorName} is out of stock.`);

  return prisma.$transaction(async (tx) => {
    let cart = token ? await tx.cart.findUnique({ where: { token } }) : null;
    if (!cart || cart.expiresAt < new Date()) {
      if (cart) await tx.cart.delete({ where: { id: cart.id } });
      cart = await tx.cart.create({ data: { token: newCartToken(), expiresAt: expiry() } });
    } else {
      await tx.cart.update({ where: { id: cart.id }, data: { expiresAt: expiry() } });
    }
    const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
    const next = (existing?.quantity ?? 0) + quantity;
    if (next > variant.stock) {
      throw new ServiceError(
        existing
          ? `Only ${variant.stock} available in ${variant.colorName}, and ${existing.quantity} already in your bag.`
          : `Only ${variant.stock} available in ${variant.colorName}.`,
      );
    }
    if (next > 99) throw new ServiceError("You can add at most 99 of one item.");
    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      update: { quantity: next },
      create: { cartId: cart.id, variantId, quantity: next },
    });
    return { token: cart.token, quantity: next };
  });
}

export async function updateCartItem(token: string | null | undefined, input: unknown) {
  const parsed = cartUpdateSchema.safeParse(input);
  if (!parsed.success || !token) throw new ServiceError("Invalid quantity.");
  const { itemId, quantity } = parsed.data;
  // Items are always looked up through the visitor's own cart token.
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { token } }, include: { variant: true } });
  if (!item) throw new ServiceError("That item is not in your bag.");
  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }
  if (quantity > item.variant.stock) throw new ServiceError(`Only ${item.variant.stock} available in ${item.variant.colorName}.`);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeCartItem(token: string | null | undefined, itemId: string) {
  if (!token) return;
  await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { token } } });
}

export async function purgeExpiredCarts(now = new Date()) {
  const { count } = await prisma.cart.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}
