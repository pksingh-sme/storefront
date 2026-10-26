"use server";

import { redirect } from "next/navigation";
import type { OrderStatus, ProductStatus } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { requireAdmin, UnauthorizedError, type AdminActor } from "@/lib/authz";
import { invalidateStorefront, TAGS } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { formToObject } from "@/lib/validation/common";
import { ServiceError, type ActionResult } from "@/server/errors";
import {
  deleteImage,
  finalizeImageUpload,
  finalizeMediaUpload,
  reorderImages,
  requestImageUpload,
  requestMediaUpload,
  setPrimaryImage,
  updateImage,
} from "@/server/images";
import { createProduct, deleteProduct, duplicateProduct, setProductStatus, updateProduct } from "@/server/products";
import { deleteBanner, deleteCategory, moveCategory, saveBanner, saveCategory, saveSettings } from "@/server/store-admin";
import { createVariant, deleteVariant, reorderVariants, updateVariant } from "@/server/variants";

/**
 * Every admin action runs through this guard: it verifies the administrator session on
 * the server, maps known errors to safe messages and invalidates storefront caches.
 */
async function guarded<T>(fn: (actor: AdminActor) => Promise<T>, opts: { invalidate?: string[] | false; success?: string } = {}): Promise<ActionResult<T>> {
  try {
    const actor = await requireAdmin();
    const data = await fn(actor);
    if (opts.invalidate !== false) invalidateStorefront(...(opts.invalidate ?? []));
    return { ok: true, data, message: opts.success };
  } catch (error) {
    if (error instanceof UnauthorizedError) return { ok: false, error: error.message };
    if (error instanceof ServiceError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    console.error("Admin action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type FormState = ActionResult<unknown> | null;

// --- Products ---------------------------------------------------------------

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await guarded((actor) => createProduct(actor, formToObject(formData)));
  if (!result.ok) return result;
  redirect(`/admin/products/${result.data!.id}?created=1`);
}

export async function updateProductAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return guarded((actor) => updateProduct(actor, productId, formToObject(formData)).then(() => undefined), { success: "Product saved." });
}

export async function setProductStatusAction(productId: string, status: ProductStatus): Promise<ActionResult> {
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return { ok: false, error: "Invalid status." };
  const labels = { DRAFT: "Product unpublished (now a draft).", PUBLISHED: "Product published.", ARCHIVED: "Product archived." };
  return guarded((actor) => setProductStatus(actor, productId, status).then(() => undefined), { success: labels[status] });
}

export async function duplicateProductAction(productId: string): Promise<ActionResult<{ id: string }>> {
  return guarded((actor) => duplicateProduct(actor, productId).then((p) => ({ id: p.id })), { invalidate: false });
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  return guarded((actor) => deleteProduct(actor, productId).then(() => undefined));
}

// --- Variants ---------------------------------------------------------------

export async function createVariantAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return guarded((actor) => createVariant(actor, productId, formToObject(formData)).then(() => undefined), { success: "Colour added." });
}

export async function updateVariantAction(variantId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return guarded((actor) => updateVariant(actor, variantId, formToObject(formData)).then(() => undefined), { success: "Colour saved." });
}

export async function deleteVariantAction(variantId: string, confirmOrderHistory: boolean): Promise<ActionResult> {
  return guarded((actor) => deleteVariant(actor, variantId, confirmOrderHistory), { success: "Colour deleted." });
}

export async function reorderVariantsAction(productId: string, ids: string[]): Promise<ActionResult> {
  return guarded((actor) => reorderVariants(actor, productId, ids));
}

// --- Product images ------------------------------------------------------------

export async function requestImageUploadAction(
  productId: string,
  variantId: string | null,
  file: { fileName: string; contentType: string; size: number },
) {
  return guarded((actor) => requestImageUpload(actor, productId, variantId, file), { invalidate: false });
}

export async function finalizeImageUploadAction(imageId: string, altText: string | null): Promise<ActionResult> {
  return guarded((actor) => finalizeImageUpload(actor, imageId, altText).then(() => undefined));
}

export async function updateImageAction(imageId: string, input: { altText: string | null; variantId: string | null }): Promise<ActionResult> {
  return guarded((actor) => updateImage(actor, imageId, input).then(() => undefined), { success: "Image updated." });
}

export async function reorderImagesAction(productId: string, variantId: string | null, ids: string[]): Promise<ActionResult> {
  return guarded((actor) => reorderImages(actor, productId, variantId, { ids }));
}

export async function setPrimaryImageAction(imageId: string): Promise<ActionResult> {
  return guarded((actor) => setPrimaryImage(actor, imageId), { success: "Main image updated." });
}

export async function deleteImageAction(imageId: string): Promise<ActionResult> {
  return guarded((actor) => deleteImage(actor, imageId), { success: "Image removed." });
}

// --- Store media (logo, banners, categories) ----------------------------------

export async function requestMediaUploadAction(file: { fileName: string; contentType: string; size: number }) {
  return guarded((actor) => requestMediaUpload(actor, file), { invalidate: false });
}

export async function finalizeMediaUploadAction(assetId: string) {
  return guarded((actor) => finalizeMediaUpload(actor, assetId), { invalidate: false });
}

// --- Categories -------------------------------------------------------------------

export async function saveCategoryAction(categoryId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const result = await guarded((actor) => saveCategory(actor, categoryId, formToObject(formData)).then((c) => ({ id: c.id })), {
    success: "Category saved.",
  });
  if (result.ok && !categoryId) redirect(`/admin/categories?saved=1`);
  return result;
}

export async function moveCategoryAction(categoryId: string, direction: "up" | "down"): Promise<ActionResult> {
  return guarded((actor) => moveCategory(actor, categoryId, direction === "up" ? "up" : "down"));
}

export async function deleteCategoryAction(categoryId: string, reassignToId: string | null): Promise<ActionResult> {
  return guarded((actor) => deleteCategory(actor, categoryId, reassignToId), { success: "Category deleted." });
}

// --- Settings and banners -----------------------------------------------------

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded((actor) => saveSettings(actor, formToObject(formData)).then(() => undefined), {
    success: "Settings saved.",
    invalidate: [TAGS.settings],
  });
}

export async function saveBannerAction(bannerId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const result = await guarded((actor) => saveBanner(actor, bannerId, formToObject(formData)).then(() => undefined), {
    success: "Banner saved.",
    invalidate: [TAGS.banners],
  });
  if (result.ok && !bannerId) redirect("/admin/banners?saved=1");
  return result;
}

export async function deleteBannerAction(bannerId: string): Promise<ActionResult> {
  return guarded((actor) => deleteBanner(actor, bannerId), { success: "Banner deleted.", invalidate: [TAGS.banners] });
}

// --- Orders -------------------------------------------------------------------------

const ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ["CANCELLED"],
  PAID: ["FULFILLED", "REFUNDED"],
  FULFILLED: ["REFUNDED"],
};

export async function updateOrderStatusAction(orderId: string, status: OrderStatus): Promise<ActionResult> {
  return guarded(
    async (actor) => {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (!order) throw new ServiceError("Order not found.");
      if (!ORDER_TRANSITIONS[order.status]?.includes(status)) throw new ServiceError(`An order that is ${order.status.toLowerCase()} can't become ${status.toLowerCase()}.`);
      await prisma.order.update({ where: { id: orderId }, data: { status } });
      // Note: refunds must also be issued in the payment provider's dashboard.
      await audit(prisma, actor.id, "order.status", "Order", orderId, { from: order.status, to: status });
    },
    { success: "Order updated.", invalidate: false },
  );
}
