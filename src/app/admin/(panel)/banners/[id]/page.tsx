import Link from "next/link";
import { notFound } from "next/navigation";
import { BannerForm } from "@/components/admin/banner-form";
import { Card, PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata = { title: "Banner" };

function toLocalInput(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function BannerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const banner = id === "new" ? null : await prisma.banner.findUnique({ where: { id } });
  if (id !== "new" && !banner) notFound();
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/banners" className="text-stone hover:underline">
          ← Banners
        </Link>
      </p>
      <PageHeader title={banner ? banner.title : "New banner"} />
      <Card className="max-w-3xl">
        <BannerForm
          bannerId={banner?.id ?? null}
          maxUploadMb={env().MAX_UPLOAD_MB}
          initial={{
            placement: banner?.placement ?? "HERO",
            title: banner?.title ?? "",
            subtitle: banner?.subtitle ?? "",
            ctaLabel: banner?.ctaLabel ?? "",
            ctaHref: banner?.ctaHref ?? "",
            altText: banner?.altText ?? "",
            isActive: banner?.isActive ?? true,
            startsAt: toLocalInput(banner?.startsAt ?? null),
            endsAt: toLocalInput(banner?.endsAt ?? null),
            sortOrder: banner?.sortOrder ?? 0,
            imageUrl: banner?.imageUrl ?? null,
          }}
        />
      </Card>
    </>
  );
}
