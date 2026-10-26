import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { Card, PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata = { title: "Category" };

export default async function CategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const category = isNew ? null : await prisma.category.findUnique({ where: { id } });
  if (!isNew && !category) notFound();
  const parents = await prisma.category.findMany({
    where: { parentId: null, ...(category ? { id: { not: category.id } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/categories" className="text-stone hover:underline">
          ← Categories
        </Link>
      </p>
      <PageHeader title={category ? category.name : "New category"} />
      <Card className="max-w-3xl">
        <CategoryForm
          categoryId={category?.id ?? null}
          parents={parents}
          maxUploadMb={env().MAX_UPLOAD_MB}
          initial={{
            name: category?.name ?? "",
            slug: category?.slug ?? "",
            description: category?.description ?? "",
            parentId: category?.parentId ?? "",
            isActive: category?.isActive ?? true,
            isFeatured: category?.isFeatured ?? false,
            imageUrl: category?.imageUrl ?? null,
            seoTitle: category?.seoTitle ?? "",
            seoDescription: category?.seoDescription ?? "",
          }}
        />
      </Card>
    </>
  );
}
