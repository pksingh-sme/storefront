import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, ProductListing } from "@/components/store/listing";
import { parseListingParams, type RawSearchParams } from "@/lib/listing-params";
import { getCategoryBySlug, getNavCategories } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Not found", robots: { index: false } };
  const description = category.seoDescription ?? category.description ?? `Shop ${category.name}.`;
  return {
    title: category.seoTitle ?? category.name,
    description,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: { title: category.seoTitle ?? category.name, description, images: category.imageUrl ? [category.imageUrl] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [category, categories, sp] = await Promise.all([getCategoryBySlug(slug), getNavCategories(), searchParams]);
  if (!category) notFound();
  const listingParams = parseListingParams(sp);

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    ...(category.parent ? [{ name: category.parent.name, href: `/category/${category.parent.slug}` }] : []),
    { name: category.name },
  ];

  return (
    <div className="container-page py-10 lg:py-14">
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl">{category.name}</h1>
        {category.description ? <p className="mt-4 text-stone">{category.description}</p> : null}
      </header>
      {category.children.length ? (
        <nav aria-label={`${category.name} subcategories`} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {category.children.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="inline-block border border-line px-4 py-1.5 text-sm hover:border-charcoal">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <div className="mt-10">
        <ProductListing basePath={`/category/${category.slug}`} params={listingParams} categoryIds={category.categoryIds} categories={categories} showCategoryFilter={false} />
      </div>
    </div>
  );
}
