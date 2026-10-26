import "server-only";
import type { GalleryImage } from "@/lib/gallery";
import { resolveVariantPrice } from "@/lib/pricing";
import { storage } from "@/lib/storage";
import { imageUrls } from "@/lib/storage/images";

type ImageRow = {
  id: string;
  variantId: string | null;
  storageKey: string;
  widths: number[];
  width: number | null;
  height: number | null;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

type VariantRow = {
  id: string;
  colorName: string;
  colorHex: string | null;
  sku: string;
  priceCents: number | null;
  salePriceCents: number | null;
  stock: number;
  isActive: boolean;
  sortOrder: number;
};

type ProductPriceRow = { basePriceCents: number; salePriceCents: number | null };

export type VariantDTO = {
  id: string;
  colorName: string;
  colorHex: string | null;
  sku: string;
  regularCents: number;
  saleCents: number | null;
  unitCents: number;
  stock: number;
  isActive: boolean;
};

export type ImageDTO = GalleryImage;

export function toImageDTO(image: ImageRow, fallbackAlt: string): ImageDTO | null {
  const urls = imageUrls(storage(), image.storageKey, image.widths);
  if (!urls) return null;
  return {
    id: image.id,
    variantId: image.variantId,
    alt: image.altText || fallbackAlt,
    ...urls,
    width: image.width,
    height: image.height,
    isPrimary: image.isPrimary,
    sortOrder: image.sortOrder,
  };
}

export function toVariantDTO(product: ProductPriceRow, v: VariantRow): VariantDTO {
  const price = resolveVariantPrice(product, v);
  return {
    id: v.id,
    colorName: v.colorName,
    colorHex: v.colorHex,
    sku: v.sku,
    regularCents: price.regularCents,
    saleCents: price.saleCents,
    unitCents: price.unitCents,
    stock: v.stock,
    isActive: v.isActive,
  };
}

export type ProductCardDTO = {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  currency: string;
  priceCents: number;
  compareAtCents: number | null;
  hasPriceRange: boolean;
  inStock: boolean;
  image: { src: string; srcSet: string; alt: string } | null;
  hoverImage: { src: string; srcSet: string; alt: string } | null;
  swatches: { name: string; hex: string | null }[];
};

export type CardSource = ProductPriceRow & {
  id: string;
  slug: string;
  name: string;
  currency: string;
  category: { name: string };
  variants: VariantRow[];
  images: ImageRow[];
};

export function toProductCard(p: CardSource): ProductCardDTO {
  const active = p.variants.filter((v) => v.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const prices = active.map((v) => resolveVariantPrice(p, v));
  const cheapest = prices.length
    ? prices.reduce((min, cur) => (cur.unitCents < min.unitCents ? cur : min))
    : resolveVariantPrice(p, { priceCents: null, salePriceCents: null });
  const distinct = new Set(prices.map((x) => x.unitCents));

  // Card image: main image of the first in-stock colour, falling back to shared images.
  const lead = active.find((v) => v.stock > 0) ?? active[0];
  const ordered = [...p.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
  const candidates = [
    ...ordered.filter((i) => lead && i.variantId === lead.id),
    ...ordered.filter((i) => i.variantId === null),
  ];
  const [first, second] = candidates.map((i) => toImageDTO(i, p.name)).filter(Boolean) as ImageDTO[];
  const pick = (i?: ImageDTO) => (i ? { src: i.src, srcSet: i.srcSet, alt: i.alt } : null);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    categoryName: p.category.name,
    currency: p.currency,
    priceCents: cheapest.unitCents,
    compareAtCents: cheapest.saleCents != null ? cheapest.regularCents : null,
    hasPriceRange: distinct.size > 1,
    inStock: active.some((v) => v.stock > 0),
    image: pick(first),
    hoverImage: pick(second),
    swatches: active.map((v) => ({ name: v.colorName, hex: v.colorHex })),
  };
}

export const cardInclude = {
  category: { select: { name: true } },
  variants: {
    select: {
      id: true,
      colorName: true,
      colorHex: true,
      sku: true,
      priceCents: true,
      salePriceCents: true,
      stock: true,
      isActive: true,
      sortOrder: true,
    },
  },
  images: {
    where: { status: "READY" as const },
    select: {
      id: true,
      variantId: true,
      storageKey: true,
      widths: true,
      width: true,
      height: true,
      altText: true,
      sortOrder: true,
      isPrimary: true,
    },
  },
};
