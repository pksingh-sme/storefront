import Link from "next/link";
import { centsToInput } from "@/lib/money";
import { listingQuery, type ListingParams } from "@/lib/listing-params";
import { getColorFacets, getListing, SORT_OPTIONS, type CategoryNode } from "@/server/catalog";
import { ProductGrid } from "./product-card";
import { SortSelect } from "./sort-select";

type Crumb = { name: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-stone">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="hover:text-charcoal">
                {c.name}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-charcoal">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export async function ProductListing({
  basePath,
  params,
  categoryIds,
  categories,
  showCategoryFilter,
}: {
  basePath: string;
  params: ListingParams;
  categoryIds?: string[];
  categories: CategoryNode[];
  showCategoryFilter: boolean;
}) {
  let filterCategoryIds = categoryIds;
  if (showCategoryFilter && params.category) {
    const root = categories.find((c) => c.slug === params.category);
    const child = categories.flatMap((c) => c.children).find((c) => c.slug === params.category);
    filterCategoryIds = root ? [root.id, ...root.children.map((c) => c.id)] : child ? [child.id] : ["__none__"];
  }

  const [result, colors] = await Promise.all([
    getListing({
      q: params.q,
      categoryIds: filterCategoryIds,
      minPriceCents: params.min,
      maxPriceCents: params.max,
      inStockOnly: params.instock,
      color: params.color,
      sort: params.sort ?? "featured",
      page: params.page,
      pageSize: 12,
    }),
    getColorFacets(filterCategoryIds ?? null),
  ]);

  const keep = {
    q: params.q,
    category: showCategoryFilter ? params.category : undefined,
    min: params.min != null ? centsToInput(params.min) : undefined,
    max: params.max != null ? centsToInput(params.max) : undefined,
    instock: params.instock,
    color: params.color,
    sort: params.sort,
  };
  const activeFilters = Boolean(params.q || params.min != null || params.max != null || params.instock || params.color || (showCategoryFilter && params.category));

  const filters = (
    <form method="get" action={basePath} className="space-y-7" aria-label="Filter products">
      <div>
        <label htmlFor="filter-q" className="eyebrow text-stone">
          Search
        </label>
        <input
          id="filter-q"
          name="q"
          type="search"
          defaultValue={params.q}
          maxLength={100}
          placeholder="Name or description"
          className="mt-2 w-full border border-line bg-white px-3 py-2 text-sm focus:border-charcoal focus:outline-none"
        />
      </div>
      {showCategoryFilter ? (
        <div>
          <label htmlFor="filter-category" className="eyebrow text-stone">
            Category
          </label>
          <select id="filter-category" name="category" defaultValue={params.category ?? ""} className="mt-2 w-full border border-line bg-white px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.slug}>All {c.name}</option>
                {c.children.map((ch) => (
                  <option key={ch.id} value={ch.slug}>
                    {ch.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}
      <fieldset>
        <legend className="eyebrow text-stone">Price</legend>
        <div className="mt-2 flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-min">
            Minimum price
          </label>
          <input id="filter-min" name="min" inputMode="decimal" placeholder="Min" defaultValue={keep.min} className="w-full border border-line bg-white px-3 py-2 text-sm" />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor="filter-max">
            Maximum price
          </label>
          <input id="filter-max" name="max" inputMode="decimal" placeholder="Max" defaultValue={keep.max} className="w-full border border-line bg-white px-3 py-2 text-sm" />
        </div>
      </fieldset>
      <fieldset>
        <legend className="eyebrow text-stone">Availability</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="instock" value="1" defaultChecked={params.instock} className="size-4 accent-charcoal" />
          In stock only
        </label>
      </fieldset>
      {colors.length ? (
        <fieldset>
          <legend className="eyebrow text-stone">Colour</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <input type="radio" name="color" value="" defaultChecked={!params.color} className="peer sr-only" />
              <span className="inline-block border border-line px-2.5 py-1 text-xs peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-ivory peer-focus-visible:outline-2 peer-focus-visible:outline-gold-deep">
                Any
              </span>
            </label>
            {colors.map((c) => (
              <label key={c.name} className="cursor-pointer">
                <input type="radio" name="color" value={c.name} defaultChecked={params.color?.toLowerCase() === c.name.toLowerCase()} className="peer sr-only" />
                <span className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1 text-xs peer-checked:border-charcoal peer-checked:bg-cream peer-focus-visible:outline-2 peer-focus-visible:outline-gold-deep">
                  <span aria-hidden="true" className="size-3 rounded-full border border-charcoal/20" style={{ backgroundColor: c.hex ?? "#ddd" }} />
                  {c.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
      <div className="flex items-center gap-4">
        <button type="submit" className="h-10 bg-charcoal px-5 text-sm text-ivory hover:bg-ink">
          Apply filters
        </button>
        {activeFilters ? (
          <Link href={basePath} className="text-sm underline underline-offset-4 hover:text-gold-deep">
            Clear all
          </Link>
        ) : null}
      </div>
    </form>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-14">
      <aside>
        <details className="group border-y border-line py-3 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
            Filters{activeFilters ? " (active)" : ""}
            <span aria-hidden="true" className="transition group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="pt-6">{filters}</div>
        </details>
        <div className="hidden lg:block">{filters}</div>
      </aside>

      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm text-stone" role="status">
            {result.total} {result.total === 1 ? "product" : "products"}
            {params.q ? (
              <>
                {" "}
                for “<span className="text-charcoal">{params.q}</span>”
              </>
            ) : null}
          </p>
          <SortSelect value={params.sort ?? "featured"} options={SORT_OPTIONS} />
        </div>

        {result.items.length ? (
          <ProductGrid products={result.items} priorityCount={4} />
        ) : (
          <div className="border border-dashed border-line px-6 py-20 text-center">
            <p className="font-display text-2xl">Nothing matches just yet</p>
            <p className="mt-2 text-sm text-stone">Try removing a filter or searching for something else.</p>
            <Link href={basePath} className="mt-6 inline-block border-b border-charcoal pb-0.5 text-sm">
              Clear filters
            </Link>
          </div>
        )}

        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-1 text-sm">
            {result.page > 1 ? (
              <Link rel="prev" href={`${basePath}${listingQuery({ ...keep, page: result.page - 1 })}`} className="px-3 py-2 hover:text-gold-deep">
                ← Previous
              </Link>
            ) : null}
            {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={`${basePath}${listingQuery({ ...keep, page: n })}`}
                aria-current={n === result.page ? "page" : undefined}
                className={n === result.page ? "bg-charcoal px-3 py-2 text-ivory" : "px-3 py-2 hover:bg-cream"}
              >
                <span className="sr-only">Page </span>
                {n}
              </Link>
            ))}
            {result.page < result.pageCount ? (
              <Link rel="next" href={`${basePath}${listingQuery({ ...keep, page: result.page + 1 })}`} className="px-3 py-2 hover:text-gold-deep">
                Next →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
