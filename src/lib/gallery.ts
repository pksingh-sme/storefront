// Pure, framework-free helpers for the colour-variant gallery. Shared by the
// storefront, the admin preview and the unit tests.

export type GalleryImage = {
  id: string;
  /** null = shared image shown for every colour. */
  variantId: string | null;
  alt: string;
  src: string;
  srcSet: string;
  thumbSrc: string;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type SelectableVariant = {
  id: string;
  colorName: string;
  stock: number;
};

function byPrimaryThenOrder(a: GalleryImage, b: GalleryImage) {
  if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
  return a.sortOrder - b.sortOrder;
}

/**
 * Images for the selected colour: that colour's own images first (main image first),
 * followed by images explicitly configured as shared. Images that belong to any other
 * colour are never included.
 */
export function galleryForVariant<T extends GalleryImage>(images: T[], variantId: string | null): T[] {
  const own = variantId ? images.filter((i) => i.variantId === variantId).sort(byPrimaryThenOrder) : [];
  const shared = images.filter((i) => i.variantId === null).sort(byPrimaryThenOrder);
  return [...own, ...shared];
}

export function colorParam(colorName: string): string {
  return colorName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Picks the variant to show when the page opens: the requested colour if it exists,
 * otherwise the first colour in stock, otherwise the first colour.
 */
export function pickDefaultVariant<T extends SelectableVariant>(variants: T[], requested?: string | null): T | null {
  if (variants.length === 0) return null;
  if (requested) {
    const match = variants.find((v) => v.id === requested || colorParam(v.colorName) === requested);
    if (match) return match;
  }
  return variants.find((v) => v.stock > 0) ?? variants[0];
}

export function wrapIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

export type StockState = { kind: "out" } | { kind: "low"; remaining: number } | { kind: "in" };

export function stockState(stock: number, lowThreshold = 3): StockState {
  if (stock <= 0) return { kind: "out" };
  if (stock <= lowThreshold) return { kind: "low", remaining: stock };
  return { kind: "in" };
}
