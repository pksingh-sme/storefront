export type ShippingTaxSettings = {
  flatShippingCents: number;
  freeShippingThresholdCents: number | null;
  taxRateBasisPoints: number;
};

export type OrderTotals = { subtotalCents: number; shippingCents: number; taxCents: number; totalCents: number };

/** Simple flat-rate shipping and percentage tax. Replace with a provider for real tax rules. */
export function computeTotals(subtotalCents: number, s: ShippingTaxSettings): OrderTotals {
  const free = s.freeShippingThresholdCents != null && subtotalCents >= s.freeShippingThresholdCents;
  const shippingCents = subtotalCents === 0 || free ? 0 : s.flatShippingCents;
  const taxCents = Math.round((subtotalCents * s.taxRateBasisPoints) / 10_000);
  return { subtotalCents, shippingCents, taxCents, totalCents: subtotalCents + shippingCents + taxCents };
}
