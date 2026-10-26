import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getSitemapEntries } from "@/server/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { products, categories } = await getSitemapEntries();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${base}/category/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...["shipping", "returns", "privacy"].map((p) => ({ url: `${base}/policies/${p}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
