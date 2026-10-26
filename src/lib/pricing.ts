export type PriceSource = { basePriceCents: number; salePriceCents: number | null };
export type VariantPriceSource = { priceCents: number | null; salePriceCents: number | null };

export type ResolvedPrice = {
  regularCents: number;
  saleCents: number | null;
  /** The amount the customer pays per unit. */
  unitCents: number;
  onSale: boolean;
};

/**
 * Resolves the price of a variant.
 *
 * - A variant with its own price uses only its own price and sale price.
 * - A variant without its own price inherits the product's base price, and its own
 *   sale price if set, otherwise the product's sale price.
 * - A sale price that is not lower than the regular price is ignored.
 */
export function resolveVariantPrice(product: PriceSource, variant: VariantPriceSource): ResolvedPrice {
  const hasOwnPrice = variant.priceCents != null;
  const regularCents = hasOwnPrice ? variant.priceCents! : product.basePriceCents;
  let saleCents = hasOwnPrice ? variant.salePriceCents : (variant.salePriceCents ?? product.salePriceCents);
  if (saleCents != null && saleCents >= regularCents) saleCents = null;
  return { regularCents, saleCents, unitCents: saleCents ?? regularCents, onSale: saleCents != null };
}

/** Lowest price a customer could pay across the given active variants. */
export function minimumPrice(product: PriceSource, variants: VariantPriceSource[]): number {
  if (variants.length === 0) return resolveVariantPrice(product, { priceCents: null, salePriceCents: null }).unitCents;
  return Math.min(...variants.map((v) => resolveVariantPrice(product, v).unitCents));
}
