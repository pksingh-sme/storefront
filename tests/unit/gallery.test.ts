import { describe, expect, it } from "vitest";
import { colorParam, galleryForVariant, pickDefaultVariant, stockState, wrapIndex, type GalleryImage } from "@/lib/gallery";

const img = (id: string, variantId: string | null, sortOrder: number, isPrimary = false): GalleryImage => ({
  id,
  variantId,
  sortOrder,
  isPrimary,
  alt: id,
  src: `/${id}.webp`,
  srcSet: "",
  thumbSrc: `/${id}-t.webp`,
  width: 100,
  height: 125,
});

const images = [
  img("burgundy-2", "burgundy", 1),
  img("burgundy-1", "burgundy", 0, true),
  img("emerald-1", "emerald", 0, true),
  img("emerald-2", "emerald", 1),
  img("shared-1", null, 0, true),
];

describe("galleryForVariant", () => {
  it("returns only the selected colour's images, main image first, then shared images", () => {
    expect(galleryForVariant(images, "burgundy").map((i) => i.id)).toEqual(["burgundy-1", "burgundy-2", "shared-1"]);
  });

  it("never includes another colour's images", () => {
    const ids = galleryForVariant(images, "emerald").map((i) => i.id);
    expect(ids).not.toContain("burgundy-1");
    expect(ids).not.toContain("burgundy-2");
  });

  it("falls back to shared images when a colour has none", () => {
    expect(galleryForVariant(images, "cream").map((i) => i.id)).toEqual(["shared-1"]);
  });

  it("puts the main image first even if its sort order is later", () => {
    const g = galleryForVariant([img("a", "v", 0), img("b", "v", 5, true)], "v");
    expect(g[0].id).toBe("b");
  });
});

describe("pickDefaultVariant", () => {
  const variants = [
    { id: "cream", colorName: "Cream", stock: 0 },
    { id: "burgundy", colorName: "Burgundy", stock: 4 },
    { id: "royal", colorName: "Royal Blue", stock: 2 },
  ];
  it("selects the first in-stock variant", () => {
    expect(pickDefaultVariant(variants)?.id).toBe("burgundy");
  });
  it("honours a requested colour by id or URL name", () => {
    expect(pickDefaultVariant(variants, "royal-blue")?.id).toBe("royal");
    expect(pickDefaultVariant(variants, "cream")?.id).toBe("cream");
  });
  it("ignores an unknown requested colour", () => {
    expect(pickDefaultVariant(variants, "purple")?.id).toBe("burgundy");
  });
  it("falls back to the first variant when all are sold out", () => {
    expect(pickDefaultVariant([{ id: "x", colorName: "X", stock: 0 }])?.id).toBe("x");
  });
  it("returns null when there are no variants", () => {
    expect(pickDefaultVariant([])).toBeNull();
  });
});

describe("helpers", () => {
  it("wraps carousel indexes in both directions", () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
  });
  it("builds URL-safe colour parameters", () => {
    expect(colorParam("Emerald Green")).toBe("emerald-green");
    expect(colorParam("Crème Brûlée")).toBe("creme-brulee");
  });
  it("describes stock levels", () => {
    expect(stockState(0)).toEqual({ kind: "out" });
    expect(stockState(2, 3)).toEqual({ kind: "low", remaining: 2 });
    expect(stockState(10, 3)).toEqual({ kind: "in" });
  });
});
