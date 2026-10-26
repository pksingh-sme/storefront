import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/** Cache tags for public catalog reads. */
export const TAGS = {
  catalog: "catalog",
  settings: "settings",
  banners: "banners",
  product: (slug: string) => `product:${slug}`,
} as const;

/**
 * Expires cached storefront data immediately after an admin change so customers
 * never see a stale price, stock level or a product that was just unpublished.
 */
export function invalidateStorefront(...extraTags: string[]) {
  for (const tag of [TAGS.catalog, ...extraTags]) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Outside a Next.js request (scripts, tests) there is no cache to invalidate.
    }
  }
  try {
    revalidatePath("/", "layout");
  } catch {
    // ignore outside Next.js
  }
}
