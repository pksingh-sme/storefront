import type { Metadata } from "next";
import { Breadcrumbs, ProductListing } from "@/components/store/listing";
import { parseListingParams, type RawSearchParams } from "@/lib/listing-params";
import { getNavCategories } from "@/server/catalog";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const params = parseListingParams(await searchParams);
  return {
    title: params.q ? `Search: ${params.q}` : "Shop all",
    description: "Browse the full collection.",
    alternates: { canonical: "/shop" },
    // Filtered and search result pages should not compete with the canonical listing.
    robots: params.q || params.color || params.min || params.max ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = parseListingParams(await searchParams);
  const categories = await getNavCategories();
  return (
    <div className="container-page py-10 lg:py-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Shop" }]} />
      <h1 className="mt-4 text-4xl sm:text-5xl">{params.q ? "Search results" : "Shop all"}</h1>
      <div className="mt-10">
        <ProductListing basePath="/shop" params={params} categories={categories} showCategoryFilter />
      </div>
    </div>
  );
}
