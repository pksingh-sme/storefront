import "server-only";
import { Prisma, type ProductStatus } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import type { AdminActor } from "@/lib/authz";
import { prisma, type Tx } from "@/lib/db";
import { minimumPrice } from "@/lib/pricing";
import { slugify } from "@/lib/slug";
import { storage } from "@/lib/storage";
import { renditionKeys } from "@/lib/storage/images";
import { productCreateSchema, productInputSchema } from "@/lib/validation/catalog";
import { fieldErrors } from "@/lib/validation/common";
import { ServiceError } from "./errors";

/** Recomputes the denormalized price and stock columns used by listing filters. */
export async function recomputeProductAggregates(tx: Tx, productId: string) {
  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: { basePriceCents: true, salePriceCents: true, variants: { where: { isActive: true } } },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      minPriceCents: minimumPrice(product, product.variants),
      totalStock: product.variants.reduce((sum, v) => sum + v.stock, 0),
    },
  });
}

async function uniqueSlug(tx: Tx, base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  let candidate = root;
  for (let n = 2; ; n++) {
    const clash = await tx.product.findFirst({ where: { slug: candidate, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } });
    if (!clash) return candidate;
    candidate = `${root}-${n}`;
  }
}

export async function createProduct(actor: AdminActor, input: unknown) {
  const parsed = productCreateSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const { name, categoryId, basePrice } = parsed.data;
  const settings = await prisma.storeSettings.findUnique({ where: { id: "store" }, select: { currency: true } });
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new ServiceError("Choose a valid category.", { categoryId: ["Choose a valid category"] });
    const product = await tx.product.create({
      data: {
        name,
        slug: await uniqueSlug(tx, name),
        categoryId,
        basePriceCents: basePrice,
        minPriceCents: basePrice,
        currency: settings?.currency ?? "USD",
        status: "DRAFT",
      },
    });
    await audit(tx, actor.id, "product.create", "Product", product.id, { name });
    return product;
  });
}

export async function updateProduct(actor: AdminActor, productId: string, input: unknown) {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const d = parsed.data;
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: productId }, select: { slug: true, status: true } });
      if (!existing) throw new ServiceError("Product not found.");
      const category = await tx.category.findUnique({ where: { id: d.categoryId }, select: { id: true } });
      if (!category) throw new ServiceError("Choose a valid category.", { categoryId: ["Choose a valid category"] });
      const product = await tx.product.update({
        where: { id: productId },
        data: {
          name: d.name,
          slug: d.slug,
          shortDescription: d.shortDescription,
          description: d.description,
          categoryId: d.categoryId,
          basePriceCents: d.basePrice,
          salePriceCents: d.salePrice,
          isFeatured: d.isFeatured,
          sortOrder: d.sortOrder,
          specifications: d.specifications,
          seoTitle: d.seoTitle,
          seoDescription: d.seoDescription,
        },
      });
      await recomputeProductAggregates(tx, productId);
      if (product.status === "PUBLISHED") {
        const issues = await publishIssues(tx, productId);
        if (issues.length) throw new ServiceError(`A published product must stay complete: ${issues.join(" ")}`);
      }
      await audit(tx, actor.id, "product.update", "Product", productId, { previousSlug: existing.slug, slug: d.slug });
      return { product, previousSlug: existing.slug };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("That slug is already used by another product.", { slug: ["Already in use"] });
    }
    throw error;
  }
}

/** Requirements a product must meet before customers can see it. */
export async function publishIssues(tx: Tx, productId: string): Promise<string[]> {
  const p = await tx.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { isActive: true } },
      variants: { where: { isActive: true }, select: { id: true } },
      images: { where: { status: "READY" }, select: { id: true } },
    },
  });
  if (!p) return ["Product not found."];
  const issues: string[] = [];
  if (!p.name.trim()) issues.push("Add a product name.");
  if (!p.shortDescription && !p.description) issues.push("Add a description.");
  if (p.basePriceCents <= 0) issues.push("Set a base price above zero.");
  if (!p.category.isActive) issues.push("Choose an active category.");
  if (p.variants.length === 0) issues.push("Add at least one active colour/variant.");
  if (p.images.length === 0) issues.push("Upload at least one image.");
  return issues;
}

export async function setProductStatus(actor: AdminActor, productId: string, status: ProductStatus) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id: productId }, select: { status: true, slug: true, publishedAt: true } });
    if (!existing) throw new ServiceError("Product not found.");
    if (status === "PUBLISHED") {
      const issues = await publishIssues(tx, productId);
      if (issues.length) throw new ServiceError(`This product can't be published yet. ${issues.join(" ")}`);
    }
    const product = await tx.product.update({
      where: { id: productId },
      data: { status, publishedAt: status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : existing.publishedAt },
    });
    await audit(tx, actor.id, `product.status.${status.toLowerCase()}`, "Product", productId, { from: existing.status, to: status });
    return product;
  });
}

export async function duplicateProduct(actor: AdminActor, productId: string) {
  return prisma.$transaction(async (tx) => {
    const src = await tx.product.findUnique({ where: { id: productId }, include: { variants: true } });
    if (!src) throw new ServiceError("Product not found.");
    const copy = await tx.product.create({
      data: {
        name: `${src.name} (copy)`,
        slug: await uniqueSlug(tx, `${src.slug}-copy`),
        shortDescription: src.shortDescription,
        description: src.description,
        categoryId: src.categoryId,
        basePriceCents: src.basePriceCents,
        salePriceCents: src.salePriceCents,
        currency: src.currency,
        status: "DRAFT",
        isFeatured: false,
        sortOrder: src.sortOrder,
        specifications: src.specifications ?? [],
        seoTitle: src.seoTitle,
        seoDescription: src.seoDescription,
      },
    });
    // SKUs must be unique, so copies get a suffix the admin can edit. Images are not
    // copied because each image owns its own files in storage.
    const suffix = copy.id.slice(-5).toUpperCase();
    for (const v of src.variants) {
      await tx.productVariant.create({
        data: {
          productId: copy.id,
          colorName: v.colorName,
          colorHex: v.colorHex,
          sku: `${v.sku}-COPY-${suffix}`.slice(0, 64),
          priceCents: v.priceCents,
          salePriceCents: v.salePriceCents,
          stock: 0,
          isActive: v.isActive,
          sortOrder: v.sortOrder,
        },
      });
    }
    await recomputeProductAggregates(tx, copy.id);
    await audit(tx, actor.id, "product.duplicate", "Product", copy.id, { sourceId: productId });
    return copy;
  });
}

export async function deleteProduct(actor: AdminActor, productId: string) {
  const images = await prisma.productImage.findMany({ where: { productId }, select: { storageKey: true, widths: true, uploadKey: true } });
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { slug: true, name: true } });
    if (!product) throw new ServiceError("Product not found.");
    // Order history survives: OrderItem.variantId is set to null and the snapshot columns remain.
    await tx.product.delete({ where: { id: productId } });
    await audit(tx, actor.id, "product.delete", "Product", productId, { name: product.name, slug: product.slug });
    return product;
  });
  // Storage cleanup happens after the database commit so a failed transaction never
  // leaves products pointing at deleted files.
  const keys = images.flatMap((i) => [...renditionKeys(i.storageKey, i.widths), ...(i.uploadKey ? [i.uploadKey] : [])]);
  await storage().deleteObjects(keys).catch((e) => console.error("Image cleanup failed", e));
  return result;
}

export type AdminProductListFilters = { q?: string; status?: ProductStatus; page?: number };

export async function listAdminProducts(f: AdminProductListFilters) {
  const pageSize = 20;
  const where: Prisma.ProductWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { slug: { contains: f.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: f.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(f.page ?? 1, 1), pageCount);
  const rows = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      category: { select: { name: true } },
      _count: { select: { variants: true } },
      images: { where: { status: "READY" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
    },
  });
  return { rows, total, page, pageCount };
}
