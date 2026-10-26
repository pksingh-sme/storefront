import Link from "next/link";
import { CategoryRowActions } from "@/components/admin/category-row-actions";
import { Card, PageHeader } from "@/components/admin/page-header";
import { Alert, Badge } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const metadata = { title: "Categories" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const all = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true, children: true } } },
  });
  const roots = all.filter((c) => !c.parentId);
  const rows = roots.flatMap((r) => [r, ...all.filter((c) => c.parentId === r.id)]);
  const options = all.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title="Categories" description="Organise products. Subcategories appear in menus under their parent." actions={<ButtonLink href="/admin/categories/new">New category</ButtonLink>} />
      {saved ? (
        <Alert tone="success" className="mb-4">
          Category saved.
        </Alert>
      ) : null}
      <Card>
        <ul className="divide-y divide-line">
          {rows.map((c) => {
            const siblings = all.filter((s) => s.parentId === c.parentId);
            const index = siblings.findIndex((s) => s.id === c.id);
            return (
              <li key={c.id} className={`flex flex-wrap items-center gap-3 py-3 ${c.parentId ? "pl-8" : ""}`}>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/categories/${c.id}`} className="font-medium hover:underline">
                    {c.parentId ? "↳ " : ""}
                    {c.name}
                  </Link>
                  <p className="text-xs text-stone">
                    /category/{c.slug} · {c._count.products} product{c._count.products === 1 ? "" : "s"}
                  </p>
                </div>
                {!c.isActive ? <Badge tone="warning">inactive</Badge> : null}
                {c.isFeatured ? <Badge tone="gold">featured</Badge> : null}
                <CategoryRowActions
                  category={{ id: c.id, name: c.name, productCount: c._count.products, childCount: c._count.children }}
                  canMoveUp={index > 0}
                  canMoveDown={index < siblings.length - 1}
                  options={options.filter((o) => o.id !== c.id)}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
