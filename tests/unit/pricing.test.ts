import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { minimumPrice, resolveVariantPrice } from "@/lib/pricing";
import { computeTotals } from "@/server/checkout/totals";

const product = { basePriceCents: 16500, salePriceCents: null };

describe("resolveVariantPrice", () => {
  it("inherits the product price when the variant has no override", () => {
    expect(resolveVariantPrice(product, { priceCents: null, salePriceCents: null })).toEqual({
      regularCents: 16500,
      saleCents: null,
      unitCents: 16500,
      onSale: false,
    });
  });

  it("uses a variant-specific price", () => {
    expect(resolveVariantPrice(product, { priceCents: 17900, salePriceCents: null }).unitCents).toBe(17900);
  });

  it("applies a variant sale price below its own price", () => {
    const p = resolveVariantPrice(product, { priceCents: 13500, salePriceCents: 11000 });
    expect(p).toMatchObject({ regularCents: 13500, saleCents: 11000, unitCents: 11000, onSale: true });
  });

  it("does not apply the product sale price to a variant with its own price", () => {
    const p = resolveVariantPrice({ basePriceCents: 9800, salePriceCents: 7900 }, { priceCents: 12000, salePriceCents: null });
    expect(p.unitCents).toBe(12000);
  });

  it("inherits the product sale price when the variant has no override", () => {
    const p = resolveVariantPrice({ basePriceCents: 9800, salePriceCents: 7900 }, { priceCents: null, salePriceCents: null });
    expect(p.unitCents).toBe(7900);
    expect(p.onSale).toBe(true);
  });

  it("ignores a sale price that is not lower than the regular price", () => {
    expect(resolveVariantPrice(product, { priceCents: 5000, salePriceCents: 6000 }).saleCents).toBeNull();
  });

  it("computes the minimum price across variants", () => {
    expect(minimumPrice(product, [{ priceCents: 20000, salePriceCents: null }, { priceCents: null, salePriceCents: 15000 }])).toBe(15000);
  });
});

describe("money", () => {
  it("parses decimal input into integer cents without floating point errors", () => {
    expect(parseMoneyToCents("0.29")).toBe(29);
    expect(parseMoneyToCents("1,250.5")).toBe(125050);
    expect(parseMoneyToCents("19.99")).toBe(1999);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("12.345")).toBeNaN();
    expect(parseMoneyToCents("-5")).toBeNaN();
    expect(parseMoneyToCents("abc")).toBeNaN();
  });

  it("formats currency", () => {
    expect(formatMoney(16500, "USD")).toBe("$165.00");
  });
});

describe("computeTotals", () => {
  const settings = { flatShippingCents: 1200, freeShippingThresholdCents: 15000, taxRateBasisPoints: 825 };
  it("adds flat shipping below the free threshold and percentage tax", () => {
    expect(computeTotals(10000, settings)).toEqual({ subtotalCents: 10000, shippingCents: 1200, taxCents: 825, totalCents: 12025 });
  });
  it("ships free at or above the threshold", () => {
    expect(computeTotals(15000, settings).shippingCents).toBe(0);
  });
});
