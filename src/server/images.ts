import "server-only";
import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import type { AdminActor } from "@/lib/authz";
import { prisma, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { ImageValidationError, imageUrls, processAndStoreImage, renditionKeys } from "@/lib/storage/images";
import { imageUpdateSchema, reorderSchema } from "@/lib/validation/catalog";
import { fieldErrors } from "@/lib/validation/common";
import { EXTENSION_FOR_TYPE, uploadRequestSchema, type AllowedImageType } from "@/lib/validation/upload";
import { ServiceError } from "./errors";

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

export function maxUploadBytes() {
  return Math.round(env().MAX_UPLOAD_MB * 1024 * 1024);
}

/** Makes sure a gallery (shared images, or one colour's images) has exactly one main image. */
async function ensurePrimary(tx: Tx, productId: string, variantId: string | null) {
  const images = await tx.productImage.findMany({
    where: { productId, variantId, status: "READY" },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: { id: true, isPrimary: true },
  });
  if (images.length && !images[0].isPrimary) {
    await tx.productImage.update({ where: { id: images[0].id }, data: { isPrimary: true } });
  }
}

async function assertGallery(tx: Tx, productId: string, variantId: string | null) {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new ServiceError("Product not found.");
  if (variantId) {
    const variant = await tx.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
    if (!variant) throw new ServiceError("That colour does not belong to this product.");
  }
}

/**
 * Step 1 of an upload: validates the declared file, reserves a pending image record and
 * returns a short-lived upload target restricted to that type and size.
 */
export async function requestImageUpload(
  actor: AdminActor,
  productId: string,
  variantId: string | null,
  file: { fileName: string; contentType: string; size: number },
) {
  const max = maxUploadBytes();
  const parsed = uploadRequestSchema(max).safeParse(file);
  if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Invalid file.");
  const contentType = parsed.data.contentType as AllowedImageType;
  const imageId = randomUUID();
  const uploadKey = `uploads/${imageId}.${EXTENSION_FOR_TYPE[contentType]}`;

  const image = await prisma.$transaction(async (tx) => {
    await assertGallery(tx, productId, variantId);
    return tx.productImage.create({
      data: {
        productId,
        variantId,
        status: "PENDING",
        storageKey: `products/${productId}/${imageId}`,
        uploadKey,
        contentType,
        altText: null,
      },
    });
  });
  const upload = await storage().createUpload(uploadKey, contentType, max);
  await audit(prisma, actor.id, "image.upload.request", "ProductImage", image.id, { productId, variantId, size: parsed.data.size });
  return { imageId: image.id, upload };
}

/**
 * Step 2: after the browser uploaded the file, verify it by content, generate the
 * responsive renditions, and add it to the end of its gallery.
 */
export async function finalizeImageUpload(actor: AdminActor, imageId: string, altText: string | null) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.status !== "PENDING" || !image.uploadKey) throw new ServiceError("Upload not found or already processed.");
  const driver = storage();
  const original = await driver.getObject(image.uploadKey);
  if (!original) throw new ServiceError("The upload did not reach storage. Please try again.");
  if (original.length > maxUploadBytes()) {
    await discardPendingImage(image.id, image.uploadKey);
    throw new ServiceError("The file is larger than allowed.");
  }

  let processed;
  try {
    processed = await processAndStoreImage(driver, original, image.storageKey);
  } catch (error) {
    await discardPendingImage(image.id, image.uploadKey);
    if (error instanceof ImageValidationError) throw new ServiceError(error.message);
    throw error;
  }

  const ready = await prisma.$transaction(async (tx) => {
    const last = await tx.productImage.aggregate({
      where: { productId: image.productId, variantId: image.variantId, status: "READY" },
      _max: { sortOrder: true },
    });
    const updated = await tx.productImage.update({
      where: { id: image.id },
      data: {
        status: "READY",
        widths: processed.widths,
        width: processed.width,
        height: processed.height,
        url: imageUrls(driver, image.storageKey, processed.widths)?.src,
        altText: altText?.trim().slice(0, 250) || null,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        uploadKey: null,
      },
    });
    await ensurePrimary(tx, image.productId, image.variantId);
    await tx.product.update({ where: { id: image.productId }, data: { updatedAt: new Date() } });
    await audit(tx, actor.id, "image.add", "ProductImage", image.id, { productId: image.productId, variantId: image.variantId });
    return tx.productImage.findUniqueOrThrow({ where: { id: updated.id } });
  });
  await driver.deleteObjects([image.uploadKey]).catch(() => undefined);
  return ready;
}

async function discardPendingImage(imageId: string, uploadKey: string) {
  await prisma.productImage.delete({ where: { id: imageId } }).catch(() => undefined);
  await storage().deleteObjects([uploadKey]).catch(() => undefined);
}

export async function updateImage(actor: AdminActor, imageId: string, input: unknown) {
  const parsed = imageUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const { altText, variantId } = parsed.data;
  return prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.status !== "READY") throw new ServiceError("Image not found.");
    const moving = image.variantId !== variantId;
    if (moving) await assertGallery(tx, image.productId, variantId);
    let sortOrder = image.sortOrder;
    if (moving) {
      const last = await tx.productImage.aggregate({ where: { productId: image.productId, variantId, status: "READY" }, _max: { sortOrder: true } });
      sortOrder = (last._max.sortOrder ?? -1) + 1;
    }
    const updated = await tx.productImage.update({
      where: { id: imageId },
      data: { altText, variantId, sortOrder, isPrimary: moving ? false : image.isPrimary },
    });
    if (moving) {
      await ensurePrimary(tx, image.productId, image.variantId);
      await ensurePrimary(tx, image.productId, variantId);
    }
    await tx.product.update({ where: { id: image.productId }, data: { updatedAt: new Date() } });
    await audit(tx, actor.id, moving ? "image.reassign" : "image.update", "ProductImage", imageId, {
      productId: image.productId,
      from: image.variantId,
      to: variantId,
    });
    return updated;
  });
}

/** Reorders one gallery. `ids` must contain exactly the images currently in that gallery. */
export async function reorderImages(actor: AdminActor, productId: string, variantId: string | null, input: unknown) {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Invalid order.");
  const { ids } = parsed.data;
  await prisma.$transaction(async (tx) => {
    const current = await tx.productImage.findMany({ where: { productId, variantId, status: "READY" }, select: { id: true } });
    const known = new Set(current.map((i) => i.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) throw new ServiceError("The gallery changed. Refresh and try again.");
    for (const [index, id] of ids.entries()) await tx.productImage.update({ where: { id }, data: { sortOrder: index } });
    await tx.product.update({ where: { id: productId }, data: { updatedAt: new Date() } });
    await audit(tx, actor.id, "image.reorder", "Product", productId, { variantId, ids });
  });
}

export async function setPrimaryImage(actor: AdminActor, imageId: string) {
  await prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.status !== "READY") throw new ServiceError("Image not found.");
    // Clear the old main image first; a partial unique index allows only one per gallery.
    await tx.productImage.updateMany({ where: { productId: image.productId, variantId: image.variantId, isPrimary: true }, data: { isPrimary: false } });
    await tx.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
    await tx.product.update({ where: { id: image.productId }, data: { updatedAt: new Date() } });
    await audit(tx, actor.id, "image.primary", "ProductImage", imageId, { productId: image.productId, variantId: image.variantId });
  });
}

export async function deleteImage(actor: AdminActor, imageId: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, include: { product: { select: { status: true } } } });
  if (!image) throw new ServiceError("Image not found.");
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    if (image.product.status === "PUBLISHED") {
      const remaining = await tx.productImage.count({ where: { productId: image.productId, status: "READY" } });
      if (remaining === 0) throw new ServiceError("A published product needs at least one image. Upload another first or unpublish.");
    }
    await ensurePrimary(tx, image.productId, image.variantId);
    await tx.product.update({ where: { id: image.productId }, data: { updatedAt: new Date() } });
    await audit(tx, actor.id, "image.delete", "ProductImage", imageId, { productId: image.productId, variantId: image.variantId });
  });
  await storage()
    .deleteObjects([...renditionKeys(image.storageKey, image.widths), ...(image.uploadKey ? [image.uploadKey] : [])])
    .catch((e) => console.error("Image cleanup failed", e));
}

/**
 * Removes uploads that were requested but never completed (abandoned tabs, failed
 * uploads) along with their temporary files. Safe to run repeatedly.
 */
export async function cleanupStaleUploads(now = Date.now()) {
  const cutoff = new Date(now - STALE_UPLOAD_MS);
  const [images, assets] = await Promise.all([
    prisma.productImage.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } } }),
    prisma.mediaAsset.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } } }),
  ]);
  const keys = [...images, ...assets].flatMap((i) => (i.uploadKey ? [i.uploadKey] : []));
  await storage().deleteObjects(keys);
  for (const i of images) await storage().deletePrefix(`${i.storageKey}/`);
  await prisma.productImage.deleteMany({ where: { id: { in: images.map((i) => i.id) } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });
  return { images: images.length, assets: assets.length };
}

// ---------------------------------------------------------------------------
// Store media (logo, banners, category images)
// ---------------------------------------------------------------------------

export async function requestMediaUpload(actor: AdminActor, file: { fileName: string; contentType: string; size: number }) {
  const max = maxUploadBytes();
  const parsed = uploadRequestSchema(max).safeParse(file);
  if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Invalid file.");
  const contentType = parsed.data.contentType as AllowedImageType;
  const assetId = randomUUID();
  const uploadKey = `uploads/${assetId}.${EXTENSION_FOR_TYPE[contentType]}`;
  const asset = await prisma.mediaAsset.create({
    data: { storageKey: `media/${assetId}`, uploadKey, contentType, status: "PENDING" },
  });
  const upload = await storage().createUpload(uploadKey, contentType, max);
  await audit(prisma, actor.id, "media.upload.request", "MediaAsset", asset.id);
  return { assetId: asset.id, upload };
}

export async function finalizeMediaUpload(actor: AdminActor, assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.status !== "PENDING" || !asset.uploadKey) throw new ServiceError("Upload not found or already processed.");
  const driver = storage();
  const original = await driver.getObject(asset.uploadKey);
  if (!original) throw new ServiceError("The upload did not reach storage. Please try again.");
  try {
    const processed = await processAndStoreImage(driver, original, asset.storageKey);
    const urls = imageUrls(driver, asset.storageKey, processed.widths);
    const ready = await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: "READY", widths: processed.widths, url: urls?.src, uploadKey: null },
    });
    await audit(prisma, actor.id, "media.add", "MediaAsset", assetId);
    return { id: ready.id, url: ready.url!, storageKey: ready.storageKey };
  } catch (error) {
    await prisma.mediaAsset.delete({ where: { id: assetId } }).catch(() => undefined);
    if (error instanceof ImageValidationError) throw new ServiceError(error.message);
    throw error;
  } finally {
    await driver.deleteObjects([asset.uploadKey]).catch(() => undefined);
  }
}

/** Resolves a READY media asset for use on a banner, category or logo. */
export async function readyMediaAsset(tx: Tx, assetId: string) {
  const asset = await tx.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.status !== "READY" || !asset.url) throw new ServiceError("The uploaded image could not be found. Upload it again.");
  return asset;
}
