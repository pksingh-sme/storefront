import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import type { AdminActor } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { renditionKeys } from "@/lib/storage/images";
import { variantInputSchema } from "@/lib/validation/catalog";
import { fieldErrors } from "@/lib/validation/common";
import { ServiceError } from "./errors";
import { publishIssues, recomputeProductAggregates } from "./products";

function uniqueViolation(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    // The violated constraint is reported differently by driver adapters; check the whole metadata.
    const target = JSON.stringify(error.meta ?? {});
    if (target.includes("sku")) return new ServiceError("That SKU is already used.", { sku: ["SKU must be unique"] });
    return new ServiceError("This product already has a colour with that name.", { colorName: ["Already exists for this product"] });
  }
  return null;
}

export async function createVariant(actor: AdminActor, productId: string, input: unknown) {
  const parsed = variantInputSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const d = parsed.data;
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new ServiceError("Product not found.");
      const last = await tx.productVariant.aggregate({ where: { productId }, _max: { sortOrder: true } });
      const variant = await tx.productVariant.create({
        data: {
          productId,
          colorName: d.colorName,
          colorHex: d.colorHex,
          sku: d.sku,
          priceCents: d.price,
          salePriceCents: d.salePrice,
          stock: d.stock,
          isActive: d.isActive,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      await recomputeProductAggregates(tx, productId);
      await audit(tx, actor.id, "variant.create", "ProductVariant", variant.id, { productId, sku: d.sku, colorName: d.colorName });
      return variant;
    });
  } catch (error) {
    throw uniqueViolation(error) ?? error;
  }
}

export async function updateVariant(actor: AdminActor, variantId: string, input: unknown) {
  const parsed = variantInputSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const d = parsed.data;
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!existing) throw new ServiceError("Variant not found.");
      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          colorName: d.colorName,
          colorHex: d.colorHex,
          sku: d.sku,
          priceCents: d.price,
          salePriceCents: d.salePrice,
          stock: d.stock,
          isActive: d.isActive,
        },
        include: { product: { select: { status: true, slug: true } } },
      });
      await recomputeProductAggregates(tx, existing.productId);
      if (variant.product.status === "PUBLISHED") {
        const issues = await publishIssues(tx, existing.productId);
        if (issues.length) throw new ServiceError(`Unpublish the product first, or keep it complete: ${issues.join(" ")}`);
      }
      await audit(tx, actor.id, "variant.update", "ProductVariant", variantId, {
        productId: existing.productId,
        changes: {
          ...(existing.stock !== d.stock ? { stock: [existing.stock, d.stock] } : {}),
          ...(existing.priceCents !== d.price ? { priceCents: [existing.priceCents, d.price] } : {}),
          ...(existing.salePriceCents !== d.salePrice ? { salePriceCents: [existing.salePriceCents, d.salePrice] } : {}),
          ...(existing.isActive !== d.isActive ? { isActive: [existing.isActive, d.isActive] } : {}),
        },
      });
      return variant;
    });
  } catch (error) {
    throw uniqueViolation(error) ?? error;
  }
}

export async function variantOrderCount(variantId: string) {
  return prisma.orderItem.count({ where: { variantId } });
}

/**
 * Deletes a colour and its images. Past orders keep their snapshot (name, SKU, price);
 * callers must pass `confirmOrderHistory` when the colour has order history.
 */
export async function deleteVariant(actor: AdminActor, variantId: string, confirmOrderHistory: boolean) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { images: { select: { storageKey: true, widths: true, uploadKey: true } }, product: { select: { status: true } } },
  });
  if (!variant) throw new ServiceError("Variant not found.");
  const orders = await variantOrderCount(variantId);
  if (orders > 0 && !confirmOrderHistory) {
    throw new ServiceError(
      `This colour appears in ${orders} past order${orders === 1 ? "" : "s"}. Consider deactivating it instead, or confirm deletion.`,
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.productVariant.delete({ where: { id: variantId } });
    await recomputeProductAggregates(tx, variant.productId);
    if (variant.product.status === "PUBLISHED") {
      const issues = await publishIssues(tx, variant.productId);
      if (issues.length) throw new ServiceError(`Deleting this would leave the published product incomplete: ${issues.join(" ")}`);
    }
    await audit(tx, actor.id, "variant.delete", "ProductVariant", variantId, {
      productId: variant.productId,
      sku: variant.sku,
      colorName: variant.colorName,
      orderHistory: orders,
    });
  });
  const keys = variant.images.flatMap((i) => [...renditionKeys(i.storageKey, i.widths), ...(i.uploadKey ? [i.uploadKey] : [])]);
  await storage().deleteObjects(keys).catch((e) => console.error("Image cleanup failed", e));
}

export async function reorderVariants(actor: AdminActor, productId: string, ids: string[]) {
  await prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({ where: { productId }, select: { id: true } });
    const known = new Set(variants.map((v) => v.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) throw new ServiceError("The colour list changed. Refresh and try again.");
    for (const [index, id] of ids.entries()) await tx.productVariant.update({ where: { id }, data: { sortOrder: index } });
    await audit(tx, actor.id, "variant.reorder", "Product", productId, { ids });
  });
}
