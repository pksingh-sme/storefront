import { z } from "zod";
import {
  checkbox,
  id,
  linkHref,
  moneyOptional,
  moneyRequired,
  optionalText,
  optionalUrl,
  requiredText,
  slug,
} from "./common";

export const specificationSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(200),
});

/** Parses specification rows from "Label: Value" lines. */
export const specificationsText = z
  .string()
  .optional()
  .nullable()
  .transform((text, ctx) => {
    const rows = (text ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const specs: z.infer<typeof specificationSchema>[] = [];
    for (const row of rows) {
      const index = row.indexOf(":");
      const parsed = specificationSchema.safeParse(
        index > 0 ? { label: row.slice(0, index), value: row.slice(index + 1) } : { label: "", value: "" },
      );
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: `Use "Label: Value" on each line (problem with "${row.slice(0, 40)}")` });
        return z.NEVER;
      }
      specs.push(parsed.data);
    }
    if (specs.length > 30) {
      ctx.addIssue({ code: "custom", message: "At most 30 specifications" });
      return z.NEVER;
    }
    return specs;
  });

// Only the fields listed here can be written from the admin product form. Status,
// aggregates and timestamps are controlled by the server (no mass assignment).
export const productInputSchema = z
  .object({
    name: requiredText(160, "Name"),
    slug,
    shortDescription: optionalText(300),
    description: optionalText(10_000),
    categoryId: id,
    basePrice: moneyRequired,
    salePrice: moneyOptional,
    isFeatured: checkbox,
    sortOrder: z.coerce.number().int().min(-10_000).max(10_000).default(0),
    specifications: specificationsText,
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
  })
  .refine((v) => v.salePrice == null || v.salePrice < v.basePrice, {
    path: ["salePrice"],
    message: "Sale price must be lower than the base price",
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const productCreateSchema = z.object({
  name: requiredText(160, "Name"),
  categoryId: id,
  basePrice: moneyRequired,
});

export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const variantInputSchema = z
  .object({
    colorName: requiredText(60, "Colour name"),
    colorHex: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v.toUpperCase() : null))
      .refine((v) => v == null || HEX_PATTERN.test(v), "Use a hex colour like #8B1E3F"),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "SKU is required")
      .max(64)
      .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Use letters, numbers, dots, dashes or underscores"),
    price: moneyOptional,
    salePrice: moneyOptional,
    stock: z.coerce.number().int("Stock must be a whole number").min(0, "Stock cannot be negative").max(1_000_000),
    isActive: checkbox,
  })
  .refine((v) => v.salePrice == null || v.price == null || v.salePrice < v.price, {
    path: ["salePrice"],
    message: "Sale price must be lower than the variant price",
  });

export type VariantInput = z.infer<typeof variantInputSchema>;

export const imageUpdateSchema = z.object({
  altText: optionalText(250),
  variantId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .pipe(id.nullable()),
});

export const reorderSchema = z.object({
  ids: z.array(id).min(1).max(200),
});

export const categoryInputSchema = z.object({
  name: requiredText(80, "Name"),
  slug,
  description: optionalText(2000),
  parentId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .pipe(id.nullable()),
  isActive: checkbox,
  isFeatured: checkbox,
  imageAssetId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  removeImage: checkbox,
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
});

export const settingsInputSchema = z.object({
  storeName: requiredText(80, "Store name"),
  tagline: optionalText(160),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency code such as USD"),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .pipe(z.email("Enter a valid email").nullable()),
  contactPhone: optionalText(40),
  address: optionalText(300),
  storeDescription: optionalText(500),
  brandStoryTitle: optionalText(120),
  brandStory: optionalText(4000),
  announcement: optionalText(200),
  announcementActive: checkbox,
  instagram: optionalUrl,
  facebook: optionalUrl,
  pinterest: optionalUrl,
  tiktok: optionalUrl,
  x: optionalUrl,
  youtube: optionalUrl,
  shippingPolicy: optionalText(20_000),
  returnsPolicy: optionalText(20_000),
  privacyPolicy: optionalText(20_000),
  flatShipping: moneyRequired,
  freeShippingThreshold: moneyOptional,
  taxRatePercent: z.coerce.number().min(0).max(50).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(3),
  logoAssetId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  removeLogo: checkbox,
});

export const bannerInputSchema = z
  .object({
    placement: z.enum(["HERO", "PROMO"]),
    title: requiredText(120, "Title"),
    subtitle: optionalText(300),
    ctaLabel: optionalText(40),
    ctaHref: linkHref,
    altText: optionalText(250),
    isActive: checkbox,
    startsAt: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? new Date(v) : null))
      .refine((d) => d == null || !Number.isNaN(d.getTime()), "Invalid date"),
    endsAt: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? new Date(v) : null))
      .refine((d) => d == null || !Number.isNaN(d.getTime()), "Invalid date"),
    sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
    imageAssetId: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt, {
    path: ["endsAt"],
    message: "End must be after start",
  });

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
  consent: z.literal("on", { error: "Please confirm you would like to receive emails" }),
  // Honeypot field: real visitors never fill it in.
  company: z.string().max(0).optional().or(z.literal("")),
});

export const cartAddSchema = z.object({
  variantId: id,
  quantity: z.coerce.number().int().min(1).max(99),
});

export const cartUpdateSchema = z.object({
  itemId: id,
  quantity: z.coerce.number().int().min(0).max(99),
});
