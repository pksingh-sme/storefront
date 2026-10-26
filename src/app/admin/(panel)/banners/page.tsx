import Link from "next/link";
import { BannerDeleteButton } from "@/components/admin/banner-delete-button";
import { Card, PageHeader } from "@/components/admin/page-header";
import { Alert, Badge } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const metadata = { title: "Banners" };

export default async function BannersPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const banners = await prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader
        title="Homepage banners"
        description="The first active hero banner appears at the top of the homepage; promo banners appear as collection tiles."
        actions={<ButtonLink href="/admin/banners/new">New banner</ButtonLink>}
      />
      {saved ? (
        <Alert tone="success" className="mb-4">
          Banner saved.
        </Alert>
      ) : null}
      <Card>
        {banners.length === 0 ? <p className="text-sm text-stone">No banners yet.</p> : null}
        <ul className="divide-y divide-line">
          {banners.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-4 py-3">
              {b.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={b.imageUrl} alt="" className="h-14 w-24 bg-cream object-cover" />
              ) : (
                <div className="h-14 w-24 bg-cream" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/admin/banners/${b.id}`} className="font-medium hover:underline">
                  {b.title}
                </Link>
                <p className="text-xs text-stone">
                  {b.placement === "HERO" ? "Hero" : "Promo"} · order {b.sortOrder}
                  {b.startsAt || b.endsAt
                    ? ` · ${b.startsAt ? `from ${b.startsAt.toLocaleDateString()}` : ""} ${b.endsAt ? `until ${b.endsAt.toLocaleDateString()}` : ""}`
                    : ""}
                </p>
              </div>
              {b.isActive ? <Badge tone="success">active</Badge> : <Badge>inactive</Badge>}
              <BannerDeleteButton bannerId={b.id} title={b.title} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
