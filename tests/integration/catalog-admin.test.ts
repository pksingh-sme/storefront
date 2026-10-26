import { readdir } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { galleryForVariant } from "@/lib/gallery";
import { storage } from "@/lib/storage";
import { loadListing, loadProductForPreview, loadPublishedProduct } from "@/server/catalog";
import { ServiceError } from "@/server/errors";
import { deleteImage, finalizeImageUpload, requestImageUpload, setPrimaryImage, updateImage } from "@/server/images";
import { createProduct, duplicateProduct, setProductStatus, updateProduct } from "@/server/products";
import { createVariant, deleteVariant, updateVariant } from "@/server/variants";
import { actor, makeCategory, pngBuffer, resetDb } from "../support/factories";

async function uploadImage(productId: string, variantId: string | null, color = "#7A1F35", alt: string | null = null) {
  const buffer = await pngBuffer(color);
  const { imageId, upload } = await requestImageUpload(actor, productId, variantId, { fileName: "photo.png", contentType: "image/png", size: buffer.length });
  expect(upload.url).toBe("/api/uploads/local");
  const image = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId } });
  // Simulate the browser's direct upload to storage.
  await storage().putObject(image.uploadKey!, buffer, "image/png");
  return finalizeImageUpload(actor, imageId, alt);
}

async function productWithColours() {
  const category = await makeCategory();
  const product = await createProduct(actor, { name: "Pashmina Shawl", categoryId: category.id, basePrice: "165.00" });
  const burgundy = await createVariant(actor, product.id, { colorName: "Burgundy", colorHex: "#7A1F35", sku: "PSH-BUR", stock: "5", isActive: "on" });
  const emerald = await createVariant(actor, product.id, { colorName: "Emerald Green", colorHex: "#1F5E4A", sku: "PSH-EMR", stock: "2", price: "179.00", isActive: "on" });
  return { category, product, burgundy, emerald };
}

const details = (categoryId: string, extra: Record<string, string> = {}) => ({
  name: "Pashmina Shawl",
  slug: "pashmina-shawl",
  categoryId,
  basePrice: "165.00",
  shortDescription: "Soft and warm.",
  ...extra,
});

beforeEach(resetDb);

describe("product creation, editing and publication", () => {
  it("creates a draft product with a unique slug and audit entry", async () => {
    const category = await makeCategory();
    const a = await createProduct(actor, { name: "Pearl Earrings", categoryId: category.id, basePrice: "68" });
    const b = await createProduct(actor, { name: "Pearl Earrings", categoryId: category.id, basePrice: "68" });
    expect(a.status).toBe("DRAFT");
    expect(a.basePriceCents).toBe(6800);
    expect(b.slug).toBe("pearl-earrings-2");
    expect(await prisma.auditLog.count({ where: { action: "product.create" } })).toBe(2);
  });

  it("validates product input", async () => {
    const category = await makeCategory();
    await expect(createProduct(actor, { name: "", categoryId: category.id, basePrice: "abc" })).rejects.toBeInstanceOf(ServiceError);
  });

  it("edits details and keeps the slug unique", async () => {
    const { product, category } = await productWithColours();
    await updateProduct(actor, product.id, details(category.id, { name: "Classic Pashmina", salePrice: "150" }));
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.name).toBe("Classic Pashmina");
    expect(updated.salePriceCents).toBe(15000);

    const other = await createProduct(actor, { name: "Other", categoryId: category.id, basePrice: "10" });
    await expect(updateProduct(actor, other.id, details(category.id, { name: "Other" }))).rejects.toThrow(/slug/i);
  });

  it("refuses to publish an incomplete product and publishes once complete", async () => {
    const { product, category, burgundy } = await productWithColours();
    await expect(setProductStatus(actor, product.id, "PUBLISHED")).rejects.toThrow(/description|image/i);
    await updateProduct(actor, product.id, details(category.id));
    await expect(setProductStatus(actor, product.id, "PUBLISHED")).rejects.toThrow(/image/i);
    await uploadImage(product.id, burgundy.id);
    const published = await setProductStatus(actor, product.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
    expect(await loadPublishedProduct("pashmina-shawl")).not.toBeNull();
  });

  it("hides unpublished and archived products from the storefront", async () => {
    const { product, category, burgundy } = await productWithColours();
    await updateProduct(actor, product.id, details(category.id));
    await uploadImage(product.id, burgundy.id);
    await setProductStatus(actor, product.id, "PUBLISHED");
    expect((await loadListing({})).total).toBe(1);

    await setProductStatus(actor, product.id, "DRAFT");
    expect(await loadPublishedProduct("pashmina-shawl")).toBeNull();
    expect((await loadListing({})).total).toBe(0);

    await setProductStatus(actor, product.id, "ARCHIVED");
    expect(await loadPublishedProduct("pashmina-shawl")).toBeNull();
    // Admin preview still works for any status.
    expect(await loadProductForPreview(product.id)).not.toBeNull();
  });

  it("duplicates a product as a draft with new SKUs and no stock", async () => {
    const { product } = await productWithColours();
    const copy = await duplicateProduct(actor, product.id);
    const variants = await prisma.productVariant.findMany({ where: { productId: copy.id } });
    expect(copy.status).toBe("DRAFT");
    expect(variants).toHaveLength(2);
    expect(variants.every((v) => v.sku.includes("-COPY-") && v.stock === 0)).toBe(true);
  });
});

describe("variants", () => {
  it("enforces unique SKUs and colour names per product", async () => {
    const { product } = await productWithColours();
    await expect(createVariant(actor, product.id, { colorName: "Cream", sku: "PSH-BUR", stock: "1" })).rejects.toThrow(/SKU/);
    await expect(createVariant(actor, product.id, { colorName: "Burgundy", sku: "PSH-NEW", stock: "1" })).rejects.toThrow(/colour/i);
  });

  it("keeps listing aggregates in sync with variant prices and stock", async () => {
    const { product, burgundy, emerald } = await productWithColours();
    let p = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(p.minPriceCents).toBe(16500);
    expect(p.totalStock).toBe(7);

    await updateVariant(actor, emerald.id, { colorName: "Emerald Green", sku: "PSH-EMR", stock: "2", price: "120", isActive: "on" });
    await updateVariant(actor, burgundy.id, { colorName: "Burgundy", sku: "PSH-BUR", stock: "0", isActive: "on" });
    p = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(p.minPriceCents).toBe(12000);
    expect(p.totalStock).toBe(2);
  });

  it("exposes variant-specific prices and stock in the product page data", async () => {
    const { product, burgundy, emerald } = await productWithColours();
    const dto = await loadProductForPreview(product.id);
    const b = dto!.variants.find((v) => v.id === burgundy.id)!;
    const e = dto!.variants.find((v) => v.id === emerald.id)!;
    expect(b).toMatchObject({ unitCents: 16500, stock: 5, sku: "PSH-BUR" });
    expect(e).toMatchObject({ unitCents: 17900, stock: 2, sku: "PSH-EMR" });
  });

  it("requires confirmation to delete a colour with order history and keeps the order snapshot", async () => {
    const { product, burgundy } = await productWithColours();
    const order = await prisma.order.create({
      data: {
        number: "ORD-T-1",
        currency: "USD",
        subtotalCents: 16500,
        totalCents: 16500,
        status: "PAID",
        items: { create: { variantId: burgundy.id, productName: "Pashmina Shawl", variantName: "Burgundy", sku: "PSH-BUR", unitPriceCents: 16500, quantity: 1 } },
      },
    });
    await expect(deleteVariant(actor, burgundy.id, false)).rejects.toThrow(/past order/);
    await deleteVariant(actor, burgundy.id, true);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.variantId).toBeNull();
    expect(item).toMatchObject({ sku: "PSH-BUR", variantName: "Burgundy", unitPriceCents: 16500 });
    expect(await prisma.productVariant.count({ where: { productId: product.id } })).toBe(1);
  });
});

describe("images and colour galleries", () => {
  it("rejects disallowed types and oversized uploads before issuing an upload URL", async () => {
    const { product } = await productWithColours();
    await expect(requestImageUpload(actor, product.id, null, { fileName: "x.svg", contentType: "image/svg+xml", size: 100 })).rejects.toThrow(/JPEG/);
    await expect(requestImageUpload(actor, product.id, null, { fileName: "x.jpg", contentType: "image/jpeg", size: 50 * 1024 * 1024 })).rejects.toThrow(/MB/);
    expect(await prisma.productImage.count()).toBe(0);
  });

  it("rejects a file whose content is not an image even if declared as one", async () => {
    const { product } = await productWithColours();
    const { imageId } = await requestImageUpload(actor, product.id, null, { fileName: "evil.png", contentType: "image/png", size: 30 });
    const image = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId } });
    await storage().putObject(image.uploadKey!, Buffer.from("<script>alert(1)</script>"), "image/png");
    await expect(finalizeImageUpload(actor, imageId, null)).rejects.toThrow(/not a supported image/);
    expect(await prisma.productImage.count()).toBe(0);
  });

  it("refuses to attach an image to a colour from another product", async () => {
    const { product } = await productWithColours();
    const other = await productWithColours().catch(() => null);
    const foreign = await createVariant(actor, (await createProduct(actor, { name: "Other", categoryId: (await makeCategory("Other")).id, basePrice: "1" })).id, {
      colorName: "Red",
      sku: "OTHER-RED",
      stock: "1",
    });
    expect(other).toBeNull(); // second call collides on SKU, proving uniqueness across products
    await expect(requestImageUpload(actor, product.id, foreign.id, { fileName: "a.png", contentType: "image/png", size: 10 })).rejects.toThrow(/does not belong/);
  });

  it("generates responsive renditions and marks the first image of each gallery as main", async () => {
    const { product, burgundy } = await productWithColours();
    const first = await uploadImage(product.id, burgundy.id, "#7A1F35", "Burgundy front");
    const second = await uploadImage(product.id, burgundy.id);
    expect(first.status).toBe("READY");
    expect(first.isPrimary).toBe(true);
    expect(second.isPrimary).toBe(false);
    expect(first.widths).toEqual([320, 640]);
    const files = await readdir(`./.test-storage/${first.storageKey}`);
    expect(files.sort()).toEqual(["w320.webp", "w640.webp"]);
    expect(first.uploadKey).toBeNull();
  });

  it("shows each colour only its own images plus shared images", async () => {
    const { product, burgundy, emerald } = await productWithColours();
    const b1 = await uploadImage(product.id, burgundy.id);
    const b2 = await uploadImage(product.id, burgundy.id);
    const e1 = await uploadImage(product.id, emerald.id, "#1F5E4A");
    const shared = await uploadImage(product.id, null, "#888888");
    const dto = (await loadProductForPreview(product.id))!;

    expect(galleryForVariant(dto.images, burgundy.id).map((i) => i.id)).toEqual([b1.id, b2.id, shared.id]);
    expect(galleryForVariant(dto.images, emerald.id).map((i) => i.id)).toEqual([e1.id, shared.id]);
  });

  it("moves an image to another colour and keeps one main image per gallery", async () => {
    const { product, burgundy, emerald } = await productWithColours();
    const b1 = await uploadImage(product.id, burgundy.id);
    const b2 = await uploadImage(product.id, burgundy.id);
    await updateImage(actor, b1.id, { altText: "Now emerald", variantId: emerald.id });

    const moved = await prisma.productImage.findUniqueOrThrow({ where: { id: b1.id } });
    const remaining = await prisma.productImage.findUniqueOrThrow({ where: { id: b2.id } });
    expect(moved).toMatchObject({ variantId: emerald.id, isPrimary: true, altText: "Now emerald" });
    expect(remaining.isPrimary).toBe(true);

    const e2 = await uploadImage(product.id, emerald.id);
    await setPrimaryImage(actor, e2.id);
    const primaries = await prisma.productImage.findMany({ where: { variantId: emerald.id, isPrimary: true } });
    expect(primaries.map((p) => p.id)).toEqual([e2.id]);
  });

  it("never exposes images of hidden colours on the storefront", async () => {
    const { product, category, burgundy, emerald } = await productWithColours();
    await updateProduct(actor, product.id, details(category.id));
    await uploadImage(product.id, burgundy.id);
    const hidden = await uploadImage(product.id, emerald.id);
    await updateVariant(actor, emerald.id, { colorName: "Emerald Green", sku: "PSH-EMR", stock: "2", isActive: "" });
    await setProductStatus(actor, product.id, "PUBLISHED");
    const dto = (await loadPublishedProduct("pashmina-shawl"))!;
    expect(dto.variants.map((v) => v.colorName)).toEqual(["Burgundy"]);
    expect(dto.images.map((i) => i.id)).not.toContain(hidden.id);
  });

  it("prevents removing the last image of a published product", async () => {
    const { product, category, burgundy } = await productWithColours();
    await updateProduct(actor, product.id, details(category.id));
    const only = await uploadImage(product.id, burgundy.id);
    await setProductStatus(actor, product.id, "PUBLISHED");
    await expect(deleteImage(actor, only.id)).rejects.toThrow(/at least one image/);
  });
});
