import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { TAGS } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { imageUrls } from "@/lib/storage/images";
import { cardInclude, toImageDTO, toProductCard, toVariantDTO, type ImageDTO, type ProductCardDTO, type VariantDTO } from "./dto";

const PUBLIC_PRODUCT: Prisma.ProductWhereInput = { status: "PUBLISHED", category: { isActive: true } };
const CACHE_SECONDS = 300;

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

export type SocialLinks = Partial<Record<"instagram" | "facebook" | "pinterest" | "tiktok" | "x" | "youtube", string>>;

export type StoreSettingsDTO = {
  storeName: string;
  tagline: string | null;
  logoUrl: string | null;
  currency: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  storeDescription: string | null;
  brandStoryTitle: string | null;
  brandStory: string | null;
  announcement: string | null;
  socialLinks: SocialLinks;
  shippingPolicy: string | null;
  returnsPolicy: string | null;
  privacyPolicy: string | null;
  flatShippingCents: number;
  freeShippingThresholdCents: number | null;
  taxRateBasisPoints: number;
  lowStockThreshold: number;
};

export async function loadSettings(): Promise<StoreSettingsDTO> {
  const s = await prisma.storeSettings.upsert({ where: { id: "store" }, update: {}, create: { id: "store" } });
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    logoUrl: s.logoUrl,
    currency: s.currency,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    storeDescription: s.storeDescription,
    brandStoryTitle: s.brandStoryTitle,
    brandStory: s.brandStory,
    announcement: s.announcementActive ? s.announcement : null,
    socialLinks: (s.socialLinks ?? {}) as SocialLinks,
    shippingPolicy: s.shippingPolicy,
    returnsPolicy: s.returnsPolicy,
    privacyPolicy: s.privacyPolicy,
    flatShippingCents: s.flatShippingCents,
    freeShippingThresholdCents: s.freeShippingThresholdCents,
    taxRateBasisPoints: s.taxRateBasisPoints,
    lowStockThreshold: s.lowStockThreshold,
  };
}

export const getSettings = unstable_cache(loadSettings, ["settings"], {
  tags: [TAGS.settings, TAGS.catalog],
  revalidate: CACHE_SECONDS,
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  children: { id: string; name: string; slug: string }[];
};

export const getNavCategories = unstable_cache(
  async (): Promise<CategoryNode[]> => {
    const roots = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        children: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } },
      },
    });
    return roots.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      children: c.children,
    }));
  },
  ["nav-categories"],
  { tags: [TAGS.catalog], revalidate: CACHE_SECONDS },
);

export type CategoryPageDTO = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  parent: { name: string; slug: string } | null;
  children: { id: string; name: string; slug: string }[];
  /** This category and its active subcategories, for product filtering. */
  categoryIds: string[];
};

export const getCategoryBySlug = unstable_cache(
  async (slug: string): Promise<CategoryPageDTO | null> => {
    const c = await prisma.category.findFirst({
      where: { slug, isActive: true, OR: [{ parentId: null }, { parent: { isActive: true } }] },
      include: {
        parent: { select: { name: true, slug: true } },
        children: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } },
      },
    });
    if (!c) return null;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      parent: c.parent,
      children: c.children,
      categoryIds: [c.id, ...c.children.map((ch) => ch.id)],
    };
  },
  ["category-by-slug"],
  { tags: [TAGS.catalog], revalidate: CACHE_SECONDS },
);

export const getFeaturedCategories = unstable_cache(
  async () => {
    const rows = await prisma.category.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 6,
      select: { id: true, name: true, slug: true, description: true, imageUrl: true },
    });
    return rows;
  },
  ["featured-categories"],
  { tags: [TAGS.catalog], revalidate: CACHE_SECONDS },
);

// ---------------------------------------------------------------------------
// Product listings
// ---------------------------------------------------------------------------

export const SORT_OPTIONS = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

export type ListingFilters = {
  q?: string;
  categoryIds?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  inStockOnly?: boolean;
  color?: string;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
};

export type ListingResult = { items: ProductCardDTO[]; total: number; page: number; pageCount: number };

export function listingWhere(f: ListingFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [PUBLIC_PRODUCT];
  if (f.categoryIds?.length) and.push({ categoryId: { in: f.categoryIds } });
  if (f.q) {
    const q = f.q.trim().slice(0, 100);
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { variants: { some: { isActive: true, colorName: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.minPriceCents != null) and.push({ minPriceCents: { gte: f.minPriceCents } });
  if (f.maxPriceCents != null) and.push({ minPriceCents: { lte: f.maxPriceCents } });
  if (f.inStockOnly) and.push({ totalStock: { gt: 0 } });
  if (f.color) and.push({ variants: { some: { isActive: true, colorName: { equals: f.color, mode: "insensitive" } } } });
  return { AND: and };
}

function listingOrder(sort: SortKey = "featured"): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" }, { id: "desc" }];
    case "price_asc":
      return [{ minPriceCents: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ minPriceCents: "desc" }, { id: "asc" }];
    default:
      return [{ isFeatured: "desc" }, { sortOrder: "asc" }, { publishedAt: "desc" }, { id: "asc" }];
  }
}

export async function loadListing(f: ListingFilters): Promise<ListingResult> {
  const pageSize = Math.min(Math.max(f.pageSize ?? 12, 1), 48);
  const where = listingWhere(f);
  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(f.page ?? 1, 1), pageCount);
  const rows = await prisma.product.findMany({
    where,
    orderBy: listingOrder(f.sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: cardInclude,
  });
  return { items: rows.map(toProductCard), total, page, pageCount };
}

export const getListing = unstable_cache(loadListing, ["listing"], { tags: [TAGS.catalog], revalidate: CACHE_SECONDS });

export const getColorFacets = unstable_cache(
  async (categoryIds: string[] | null): Promise<{ name: string; hex: string | null }[]> => {
    const rows = await prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: { ...PUBLIC_PRODUCT, ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}) },
      },
      select: { colorName: true, colorHex: true },
      orderBy: { colorName: "asc" },
    });
    const seen = new Map<string, { name: string; hex: string | null }>();
    for (const r of rows) {
      const key = r.colorName.toLowerCase();
      if (!seen.has(key)) seen.set(key, { name: r.colorName, hex: r.colorHex });
    }
    return [...seen.values()];
  },
  ["color-facets"],
  { tags: [TAGS.catalog], revalidate: CACHE_SECONDS },
);

export const getHomeCollections = unstable_cache(
  async () => {
    const [featured, newest, bestRows] = await Promise.all([
      prisma.product.findMany({
        where: { ...PUBLIC_PRODUCT, isFeatured: true },
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
        take: 8,
        include: cardInclude,
      }),
      prisma.product.findMany({ where: PUBLIC_PRODUCT, orderBy: { publishedAt: "desc" }, take: 8, include: cardInclude }),
      prisma.orderItem.groupBy({
        by: ["variantId"],
        where: { variantId: { not: null }, order: { status: { in: ["PAID", "FULFILLED"] } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 50,
      }),
    ]);

    let bestSellers: ProductCardDTO[] = [];
    if (bestRows.length) {
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: bestRows.map((r) => r.variantId!) } },
        select: { id: true, productId: true },
      });
      const productOrder: string[] = [];
      for (const r of bestRows) {
        const pid = variants.find((v) => v.id === r.variantId)?.productId;
        if (pid && !productOrder.includes(pid)) productOrder.push(pid);
      }
      const products = await prisma.product.findMany({
        where: { ...PUBLIC_PRODUCT, id: { in: productOrder.slice(0, 8) } },
        include: cardInclude,
      });
      bestSellers = productOrder
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is (typeof products)[number] => Boolean(p))
        .map(toProductCard);
    }

    return {
      featured: featured.map(toProductCard),
      newArrivals: newest.map(toProductCard),
      bestSellers,
    };
  },
  ["home-collections"],
  { tags: [TAGS.catalog], revalidate: CACHE_SECONDS },
);

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

export type BannerDTO = {
  id: string;
  placement: "HERO" | "PROMO";
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  altText: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

const getAllActiveBanners = unstable_cache(
  async (): Promise<BannerDTO[]> => {
    const rows = await prisma.banner.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return rows.map((b) => ({
      id: b.id,
      placement: b.placement,
      title: b.title,
      subtitle: b.subtitle,
      ctaLabel: b.ctaLabel,
      ctaHref: b.ctaHref,
      imageUrl: b.imageUrl,
      altText: b.altText,
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
    }));
  },
  ["banners"],
  { tags: [TAGS.banners, TAGS.catalog], revalidate: CACHE_SECONDS },
);

/** Active banners whose schedule includes now. The schedule check runs per request. */
export async function getLiveBanners(now = new Date()) {
  const all = await getAllActiveBanners();
  const live = all.filter(
    (b) => (!b.startsAt || new Date(b.startsAt) <= now) && (!b.endsAt || new Date(b.endsAt) > now),
  );
  return { hero: live.filter((b) => b.placement === "HERO"), promo: live.filter((b) => b.placement === "PROMO") };
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------

export type ProductDetailDTO = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  currency: string;
  seoTitle: string | null;
  seoDescription: string | null;
  specifications: { label: string; value: string }[];
  category: { id: string; name: string; slug: string; parent: { name: string; slug: string } | null };
  variants: VariantDTO[];
  images: ImageDTO[];
  updatedAt: string;
};

const detailInclude = {
  category: { select: { id: true, name: true, slug: true, parent: { select: { name: true, slug: true } } } },
  variants: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
  images: { where: { status: "READY" as const }, orderBy: { sortOrder: "asc" as const } },
};

type DetailRow = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;

/** Maps a product to the customer-facing shape. Inactive colours are omitted unless `includeInactive`. */
export function toProductDetail(p: DetailRow, includeInactive = false): ProductDetailDTO {
  const variants = p.variants.filter((v) => includeInactive || v.isActive);
  const variantIds = new Set(variants.map((v) => v.id));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    currency: p.currency,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    specifications: Array.isArray(p.specifications) ? (p.specifications as ProductDetailDTO["specifications"]) : [],
    category: p.category,
    variants: variants.map((v) => toVariantDTO(p, v)),
    // Images of hidden colours are dropped so they can never leak into another colour's gallery.
    images: p.images
      .filter((i) => i.variantId === null || variantIds.has(i.variantId))
      .map((i) => toImageDTO(i, p.name))
      .filter((i): i is ImageDTO => i !== null),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function loadPublishedProduct(slug: string): Promise<ProductDetailDTO | null> {
  const p = await prisma.product.findFirst({ where: { ...PUBLIC_PRODUCT, slug }, include: detailInclude });
  return p ? toProductDetail(p) : null;
}

export const getPublishedProduct = (slug: string) =>
  unstable_cache(() => loadPublishedProduct(slug), ["product", slug], {
    tags: [TAGS.catalog, TAGS.product(slug)],
    revalidate: CACHE_SECONDS,
  })();

/** Admin preview: any status, including inactive colours. Never cached. */
export async function loadProductForPreview(productId: string): Promise<ProductDetailDTO | null> {
  const p = await prisma.product.findUnique({ where: { id: productId }, include: detailInclude });
  return p ? toProductDetail(p, true) : null;
}

export const getRelatedProducts = unstable_cache(
  async (productId: string, categoryId: string): Promise<ProductCardDTO[]> => {
    const sameCategory = await prisma.product.findMany({
      where: { ...PUBLIC_PRODUCT, categoryId, id: { not: productId } },
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      take: 4,
      include: cardInclude,
    });
    let rows = sameCategory;
    if (rows.length < 4) {
      const more = await prisma.product.findMany({
        where: { ...PUBLIC_PRODUCT, id: { notIn: [productId, ...rows.map((r) => r.id)] }, isFeatured: true },
        take: 4 - rows.length,
        include: cardInclude,
      });
      rows = [...rows, ...more];
    }
    return rows.map(toProductCard);
  },
  ["related-products"],
  { tags: [TAGS.catalog], revalidate: CACHE_SECONDS },
);

export async function getSitemapEntries() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: PUBLIC_PRODUCT, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return { products, categories };
}

export function bannerImageUrl(key: string | null, widths: number[]) {
  if (!key) return null;
  return imageUrls(storage(), key, widths)?.src ?? null;
}
