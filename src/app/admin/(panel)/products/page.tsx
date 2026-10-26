import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { Badge } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import type { ProductStatus } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { storage } from "@/lib/storage";
import { imageUrls } from "@/lib/storage/images";
import { listAdminProducts } from "@/server/products";

export const metadata = { title: "Products" };

const STATUSES: ProductStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as ProductStatus) ? (sp.status as ProductStatus) : undefined;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const page = Number.parseInt(sp.page ?? "1", 10) || 1;
  const { rows, total, page: current, pageCount } = await listAdminProducts({ q, status, page });
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Products" description={`${total} product${total === 1 ? "" : "s"}`} actions={<ButtonLink href="/admin/products/new">New product</ButtonLink>} />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <label htmlFor="admin-q" className="sr-only">
          Search products
        </label>
        <input id="admin-q" name="q" defaultValue={q} placeholder="Search name, slug or SKU" className="w-64 border border-line bg-white px-3 py-2 text-sm" />
        <label htmlFor="admin-status" className="sr-only">
          Status
        </label>
        <select id="admin-status" name="status" defaultValue={status ?? ""} className="border border-line bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <button className="bg-charcoal px-4 text-sm text-ivory">Filter</button>
      </form>

      <div className="overflow-x-auto border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-cream/60 text-xs uppercase tracking-wider text-stone">
            <tr>
              <th scope="col" className="px-4 py-3">
                Product
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Category
              </th>
              <th scope="col" className="px-4 py-3">
                From
              </th>
              <th scope="col" className="px-4 py-3">
                Stock
              </th>
              <th scope="col" className="px-4 py-3">
                Updated
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => {
              const thumb = p.images[0] ? imageUrls(storage(), p.images[0].storageKey, p.images[0].widths)?.thumbSrc : null;
              return (
                <tr key={p.id} data-testid="admin-product-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {thumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={thumb} alt="" className="h-12 w-10 bg-cream object-cover" />
                      ) : (
                        <div className="h-12 w-10 bg-cream" />
                      )}
                      <div>
                        <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-stone">
                          {p._count.variants} colour{p._count.variants === 1 ? "" : "s"}
                          {p.isFeatured ? " · Featured" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "DRAFT" ? "neutral" : "warning"}>{p.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3">{p.category.name}</td>
                  <td className="px-4 py-3">{formatMoney(p.minPriceCents, p.currency)}</td>
                  <td className="px-4 py-3">{p.totalStock === 0 ? <Badge tone="danger">0</Badge> : p.totalStock}</td>
                  <td className="px-4 py-3 text-stone">{p.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-3 text-right">
                    <ProductRowActions productId={p.id} status={p.status} slug={p.slug} name={p.name} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-stone">
                  No products found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center gap-3 text-sm">
          {current > 1 ? <Link href={qs(current - 1)}>← Previous</Link> : null}
          <span>
            Page {current} of {pageCount}
          </span>
          {current < pageCount ? <Link href={qs(current + 1)}>Next →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
