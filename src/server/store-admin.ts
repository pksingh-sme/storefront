import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import type { AdminActor } from "@/lib/authz";
import { prisma, type Tx } from "@/lib/db";
import { storage } from "@/lib/storage";
import { renditionKeys } from "@/lib/storage/images";
import { bannerInputSchema, categoryInputSchema, settingsInputSchema } from "@/lib/validation/catalog";
import { fieldErrors, id as idSchema } from "@/lib/validation/common";
import { ServiceError } from "./errors";
import { readyMediaAsset } from "./images";

/** Deletes a media asset's files once nothing references it any more. */
async function releaseMedia(storageKey: string | null | undefined) {
  if (!storageKey) return;
  const asset = await prisma.mediaAsset.findUnique({ where: { storageKey } });
  if (!asset) return;
  const [banners, categories, settings] = await Promise.all([
    prisma.banner.count({ where: { imageKey: storageKey } }),
    prisma.category.count({ where: { imageKey: storageKey } }),
    prisma.storeSettings.count({ where: { logoKey: storageKey } }),
  ]);
  if (banners + categories + settings > 0) return;
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await storage().deleteObjects(renditionKeys(asset.storageKey, asset.widths)).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

async function assertNoCycle(tx: Tx, categoryId: string | null, parentId: string | null) {
  if (!parentId) return;
  if (parentId === categoryId) throw new ServiceError("A category cannot be its own parent.", { parentId: ["Choose another parent"] });
  const parent = await tx.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new ServiceError("Parent category not found.", { parentId: ["Not found"] });
  // Keep the tree two levels deep: category > subcategory.
  if (parent.parentId) throw new ServiceError("Subcategories cannot have their own subcategories.", { parentId: ["Choose a top-level category"] });
  if (categoryId) {
    const children = await tx.category.count({ where: { parentId: categoryId } });
    if (children > 0) throw new ServiceError("This category has subcategories, so it must stay top-level.", { parentId: ["Must be top-level"] });
  }
}

export async function saveCategory(actor: AdminActor, categoryId: string | null, input: unknown) {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const d = parsed.data;
  let previousImageKey: string | null = null;
  try {
    const category = await prisma.$transaction(async (tx) => {
      await assertNoCycle(tx, categoryId, d.parentId);
      const existing = categoryId ? await tx.category.findUnique({ where: { id: categoryId } }) : null;
      if (categoryId && !existing) throw new ServiceError("Category not found.");
      previousImageKey = existing?.imageKey ?? null;
      let image: { imageKey: string | null; imageUrl: string | null } | undefined;
      if (d.imageAssetId) {
        const asset = await readyMediaAsset(tx, d.imageAssetId);
        image = { imageKey: asset.storageKey, imageUrl: asset.url };
      } else if (d.removeImage) {
        image = { imageKey: null, imageUrl: null };
      }
      const data = {
        name: d.name,
        slug: d.slug,
        description: d.description,
        parentId: d.parentId,
        isActive: d.isActive,
        isFeatured: d.isFeatured,
        seoTitle: d.seoTitle,
        seoDescription: d.seoDescription,
        ...(image ?? {}),
      };
      const saved = existing
        ? await tx.category.update({ where: { id: existing.id }, data })
        : await tx.category.create({
            data: { ...data, sortOrder: ((await tx.category.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1 },
          });
      await audit(tx, actor.id, existing ? "category.update" : "category.create", "Category", saved.id, { name: d.name, isActive: d.isActive });
      if (!image) previousImageKey = null;
      return saved;
    });
    if (previousImageKey && previousImageKey !== category.imageKey) await releaseMedia(previousImageKey);
    return category;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceError("That slug is already used by another category.", { slug: ["Already in use"] });
    }
    throw error;
  }
}

export async function moveCategory(actor: AdminActor, categoryId: string, direction: "up" | "down") {
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new ServiceError("Category not found.");
    const siblings = await tx.category.findMany({ where: { parentId: category.parentId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const index = siblings.findIndex((s) => s.id === categoryId);
    const swapWith = siblings[direction === "up" ? index - 1 : index + 1];
    if (!swapWith) return;
    const reordered = [...siblings];
    reordered[index] = swapWith;
    reordered[direction === "up" ? index - 1 : index + 1] = category;
    for (const [i, c] of reordered.entries()) await tx.category.update({ where: { id: c.id }, data: { sortOrder: i } });
    await audit(tx, actor.id, "category.reorder", "Category", categoryId, { direction });
  });
}

/**
 * Deletes a category. Categories with subcategories cannot be deleted; categories with
 * products require an explicit target category to move those products to.
 */
export async function deleteCategory(actor: AdminActor, categoryId: string, reassignToId: string | null) {
  const imageKey = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new ServiceError("Category not found.");
    if (category._count.children > 0) throw new ServiceError("Move or delete its subcategories first.");
    if (category._count.products > 0) {
      if (!reassignToId) {
        throw new ServiceError(
          `This category contains ${category._count.products} product(s). Choose a category to move them to, or deactivate it instead.`,
        );
      }
      if (!idSchema.safeParse(reassignToId).success || reassignToId === categoryId) throw new ServiceError("Choose a different category.");
      const target = await tx.category.findUnique({ where: { id: reassignToId }, select: { id: true } });
      if (!target) throw new ServiceError("Target category not found.");
      await tx.product.updateMany({ where: { categoryId }, data: { categoryId: reassignToId } });
    }
    await tx.category.delete({ where: { id: categoryId } });
    await audit(tx, actor.id, "category.delete", "Category", categoryId, {
      name: category.name,
      movedProducts: category._count.products,
      reassignToId,
    });
    return category.imageKey;
  });
  await releaseMedia(imageKey);
}

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

export async function saveSettings(actor: AdminActor, input: unknown) {
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const d = parsed.data;
  const socialLinks = Object.fromEntries(
    (["instagram", "facebook", "pinterest", "tiktok", "x", "youtube"] as const).filter((k) => d[k]).map((k) => [k, d[k]]),
  );
  const { previous, saved } = await prisma.$transaction(async (tx) => {
    const previous = await tx.storeSettings.upsert({ where: { id: "store" }, update: {}, create: { id: "store" } });
    let logo: { logoKey: string | null; logoUrl: string | null } | undefined;
    if (d.logoAssetId) {
      const asset = await readyMediaAsset(tx, d.logoAssetId);
      logo = { logoKey: asset.storageKey, logoUrl: asset.url };
    } else if (d.removeLogo) {
      logo = { logoKey: null, logoUrl: null };
    }
    const saved = await tx.storeSettings.update({
      where: { id: "store" },
      data: {
        storeName: d.storeName,
        tagline: d.tagline,
        currency: d.currency,
        contactEmail: d.contactEmail,
        contactPhone: d.contactPhone,
        address: d.address,
        storeDescription: d.storeDescription,
        brandStoryTitle: d.brandStoryTitle,
        brandStory: d.brandStory,
        announcement: d.announcement,
        announcementActive: d.announcementActive,
        socialLinks,
        shippingPolicy: d.shippingPolicy,
        returnsPolicy: d.returnsPolicy,
        privacyPolicy: d.privacyPolicy,
        flatShippingCents: d.flatShipping,
        freeShippingThresholdCents: d.freeShippingThreshold,
        taxRateBasisPoints: Math.round(d.taxRatePercent * 100),
        lowStockThreshold: d.lowStockThreshold,
        ...(logo ?? {}),
      },
    });
    if (previous.currency !== d.currency) {
      // Products are priced in the store currency; keep them consistent.
      await tx.product.updateMany({ data: { currency: d.currency } });
    }
    await audit(tx, actor.id, "settings.update", "StoreSettings", "store", { currency: d.currency });
    return { previous, saved };
  });
  if (previous.logoKey && previous.logoKey !== saved.logoKey) await releaseMedia(previous.logoKey);
  return saved;
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

export async function saveBanner(actor: AdminActor, bannerId: string | null, input: unknown) {
  const parsed = bannerInputSchema.safeParse(input);
  if (!parsed.success) throw new ServiceError("Please fix the highlighted fields.", fieldErrors(parsed.error));
  const d = parsed.data;
  const { saved, previousKey } = await prisma.$transaction(async (tx) => {
    const existing = bannerId ? await tx.banner.findUnique({ where: { id: bannerId } }) : null;
    if (bannerId && !existing) throw new ServiceError("Banner not found.");
    let image: { imageKey: string; imageUrl: string | null } | undefined;
    if (d.imageAssetId) {
      const asset = await readyMediaAsset(tx, d.imageAssetId);
      image = { imageKey: asset.storageKey, imageUrl: asset.url };
    }
    const data = {
      placement: d.placement,
      title: d.title,
      subtitle: d.subtitle,
      ctaLabel: d.ctaLabel,
      ctaHref: d.ctaHref,
      altText: d.altText,
      isActive: d.isActive,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      sortOrder: d.sortOrder,
      ...(image ?? {}),
    };
    const saved = existing ? await tx.banner.update({ where: { id: existing.id }, data }) : await tx.banner.create({ data });
    await audit(tx, actor.id, existing ? "banner.update" : "banner.create", "Banner", saved.id, { title: d.title });
    return { saved, previousKey: image ? existing?.imageKey : null };
  });
  if (previousKey && previousKey !== saved.imageKey) await releaseMedia(previousKey);
  return saved;
}

export async function deleteBanner(actor: AdminActor, bannerId: string) {
  const banner = await prisma.banner.findUnique({ where: { id: bannerId } });
  if (!banner) throw new ServiceError("Banner not found.");
  await prisma.$transaction(async (tx) => {
    await tx.banner.delete({ where: { id: bannerId } });
    await audit(tx, actor.id, "banner.delete", "Banner", bannerId, { title: banner.title });
  });
  await releaseMedia(banner.imageKey);
}
