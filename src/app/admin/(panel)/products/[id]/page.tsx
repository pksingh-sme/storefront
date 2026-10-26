import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageManager, type AdminImage } from "@/components/admin/image-manager";
import { Card, PageHeader } from "@/components/admin/page-header";
import { ProductDetailsForm } from "@/components/admin/product-details-form";
import { ProductStatusPanel } from "@/components/admin/product-status-panel";
import { VariantManager } from "@/components/admin/variant-manager";
import { ProductExperience } from "@/components/product/product-experience";
import { Alert, Badge } from "@/components/ui/alert";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { imageUrls } from "@/lib/storage/images";
import { loadProductForPreview } from "@/server/catalog";
import { publishIssues } from "@/server/products";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { orderItems: true } } } },
      images: { where: { status: "READY" }, orderBy: [{ sortOrder: "asc" }] },
    },
  });
  if (!product) notFound();
  const [categories, issues, preview] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
    prisma.$transaction((tx) => publishIssues(tx, id)),
    loadProductForPreview(id),
  ]);

  const images: AdminImage[] = product.images.flatMap((i) => {
    const urls = imageUrls(storage(), i.storageKey, i.widths);
    return urls ? [{ id: i.id, variantId: i.variantId, altText: i.altText ?? "", thumbSrc: urls.thumbSrc, src: urls.src, isPrimary: i.isPrimary, sortOrder: i.sortOrder }] : [];
  });

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/products" className="text-stone hover:underline">
          ← Products
        </Link>
      </p>
      <PageHeader
        title={product.name}
        description={
          <span className="flex items-center gap-2">
            <Badge tone={product.status === "PUBLISHED" ? "success" : product.status === "DRAFT" ? "neutral" : "warning"}>{product.status.toLowerCase()}</Badge>
            <span>/product/{product.slug}</span>
          </span>
        }
      />
      {created ? (
        <Alert tone="success" className="mb-6">
          Draft created. Next, add colours and upload images for each colour, then publish.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Product details">
            <ProductDetailsForm
              productId={product.id}
              categories={categories}
              initial={{
                name: product.name,
                slug: product.slug,
                shortDescription: product.shortDescription ?? "",
                description: product.description ?? "",
                categoryId: product.categoryId,
                basePriceCents: product.basePriceCents,
                salePriceCents: product.salePriceCents,
                isFeatured: product.isFeatured,
                sortOrder: product.sortOrder,
                specifications: (Array.isArray(product.specifications) ? (product.specifications as { label: string; value: string }[]) : [])
                  .map((s) => `${s.label}: ${s.value}`)
                  .join("\n"),
                seoTitle: product.seoTitle ?? "",
                seoDescription: product.seoDescription ?? "",
                currency: product.currency,
              }}
            />
          </Card>

          <Card title="Colours & variants">
            <div id="variants" />
            <VariantManager
              productId={product.id}
              currency={product.currency}
              variants={product.variants.map((v) => ({
                id: v.id,
                colorName: v.colorName,
                colorHex: v.colorHex,
                sku: v.sku,
                priceCents: v.priceCents,
                salePriceCents: v.salePriceCents,
                stock: v.stock,
                isActive: v.isActive,
                orderCount: v._count.orderItems,
              }))}
            />
          </Card>

          <Card title="Images">
            <ImageManager
              productId={product.id}
              productName={product.name}
              variants={product.variants.map((v) => ({ id: v.id, colorName: v.colorName, colorHex: v.colorHex }))}
              images={images}
              maxUploadMb={env().MAX_UPLOAD_MB}
            />
          </Card>

          <Card title="Customer preview">
            <p className="mb-6 text-sm text-stone">
              Exactly what shoppers will see, including colour switching and each colour&apos;s gallery. Hidden colours are shown faded here but are not visible to customers.
            </p>
            {preview ? <ProductExperience product={preview} mode="preview" /> : null}
          </Card>
        </div>

        <div className="space-y-6">
          <ProductStatusPanel productId={product.id} status={product.status} slug={product.slug} name={product.name} issues={issues} />
        </div>
      </div>
    </>
  );
}
