// Development seed data. Everything created here is clearly marked as SAMPLE content:
// names, prices and stock levels are placeholders, not real business data.
//
//   npm run db:seed            # seeds an empty catalog
//   SEED_RESET=true npm run db:seed   # wipes catalog data first (refused in production)
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { minimumPrice } from "@/lib/pricing";
import { storage } from "@/lib/storage";
import { imageUrls, processAndStoreImage } from "@/lib/storage/images";
import { placeholderImage, type Motif } from "./seed-images";

type SeedVariant = {
  colorName: string;
  colorHex: string;
  sku: string;
  stock: number;
  price?: number;
  salePrice?: number;
  images: number;
};

type SeedProduct = {
  name: string;
  slug: string;
  category: string;
  motif: Motif;
  basePrice: number;
  salePrice?: number;
  featured?: boolean;
  shortDescription: string;
  description: string;
  specifications: { label: string; value: string }[];
  variants: SeedVariant[];
  sharedImages?: { label: string; color: string }[];
};

const SAMPLE_NOTE = "\n\n(Sample product for development — replace with your own description, photos, prices and stock.)";

const categories = [
  { slug: "shawls-wraps", name: "Shawls & Wraps", description: "Soft, hand-finished shawls, stoles and wraps.", color: "#7A1F35", featured: true },
  { slug: "pashmina", name: "Pashmina", description: "Fine pashmina shawls in seasonal colours.", color: "#9C3D54", parent: "shawls-wraps" },
  { slug: "curtains", name: "Curtains", description: "Linen and velvet curtains to dress every window.", color: "#B8A68A", featured: true },
  { slug: "earrings", name: "Earrings", description: "Everyday and occasion earrings.", color: "#B08D57", featured: true },
  { slug: "clothing", name: "Clothing", description: "Easy, elegant pieces for every season.", color: "#A0522D", featured: true },
  { slug: "accessories", name: "Accessories", description: "Bags and finishing touches.", color: "#8C7B65" },
];

const products: SeedProduct[] = [
  {
    name: "Classic Pashmina Shawl",
    slug: "classic-pashmina-shawl",
    category: "pashmina",
    motif: "shawl",
    basePrice: 16500,
    featured: true,
    shortDescription: "A featherlight pashmina shawl with hand-knotted fringe, in four seasonal colours.",
    description:
      "Woven from fine pashmina for warmth without weight, this shawl drapes beautifully over shoulders or wraps as a scarf. Each piece is finished by hand with a knotted fringe." +
      SAMPLE_NOTE,
    specifications: [
      { label: "Material", value: "Pashmina (sample)" },
      { label: "Size", value: "200 × 70 cm (sample)" },
      { label: "Care", value: "Dry clean only" },
    ],
    variants: [
      { colorName: "Burgundy", colorHex: "#7A1F35", sku: "SAMPLE-PSH-BUR", stock: 8, images: 3 },
      { colorName: "Emerald Green", colorHex: "#1F5E4A", sku: "SAMPLE-PSH-EMR", stock: 2, images: 3 },
      { colorName: "Cream", colorHex: "#EFE6D2", sku: "SAMPLE-PSH-CRM", stock: 0, images: 3 },
      { colorName: "Royal Blue", colorHex: "#27408B", sku: "SAMPLE-PSH-RBL", stock: 5, price: 17900, images: 3 },
    ],
    sharedImages: [{ label: "Fringe & weave detail", color: "#8C7B65" }],
  },
  {
    name: "Embroidered Wool Stole",
    slug: "embroidered-wool-stole",
    category: "shawls-wraps",
    motif: "shawl",
    basePrice: 9800,
    salePrice: 7900,
    shortDescription: "A lightweight wool stole with tonal paisley embroidery.",
    description: "Delicate tonal embroidery runs along both borders of this versatile stole." + SAMPLE_NOTE,
    specifications: [
      { label: "Material", value: "Wool blend (sample)" },
      { label: "Size", value: "180 × 60 cm (sample)" },
    ],
    variants: [
      { colorName: "Mustard", colorHex: "#C9971C", sku: "SAMPLE-STL-MUS", stock: 6, images: 2 },
      { colorName: "Teal", colorHex: "#1D6B73", sku: "SAMPLE-STL-TEA", stock: 4, images: 2 },
    ],
  },
  {
    name: "Sheer Linen Curtains",
    slug: "sheer-linen-curtains",
    category: "curtains",
    motif: "curtain",
    basePrice: 12000,
    featured: true,
    shortDescription: "Airy linen-blend curtains that soften daylight. Sold as a pair.",
    description: "A relaxed linen-blend weave filters light gently while keeping rooms bright." + SAMPLE_NOTE,
    specifications: [
      { label: "Material", value: "Linen blend (sample)" },
      { label: "Size", value: "Pair, 140 × 250 cm each (sample)" },
      { label: "Heading", value: "Rod pocket" },
    ],
    variants: [
      { colorName: "Ivory", colorHex: "#F3EDE0", sku: "SAMPLE-CRT-LIN-IVO", stock: 10, images: 2 },
      { colorName: "Sand", colorHex: "#D7C3A3", sku: "SAMPLE-CRT-LIN-SND", stock: 7, images: 2 },
      { colorName: "Charcoal", colorHex: "#3A3A3C", sku: "SAMPLE-CRT-LIN-CHR", stock: 3, price: 13500, salePrice: 11000, images: 2 },
    ],
  },
  {
    name: "Velvet Blackout Curtains",
    slug: "velvet-blackout-curtains",
    category: "curtains",
    motif: "curtain",
    basePrice: 18500,
    shortDescription: "Plush velvet with a blackout lining for restful rooms. Sold as a pair.",
    description: "Deep, light-catching velvet with a thermal blackout lining." + SAMPLE_NOTE,
    specifications: [
      { label: "Material", value: "Polyester velvet (sample)" },
      { label: "Lining", value: "Blackout" },
    ],
    variants: [
      { colorName: "Midnight Navy", colorHex: "#1E2A44", sku: "SAMPLE-CRT-VLV-NVY", stock: 5, images: 2 },
      { colorName: "Olive", colorHex: "#5B6236", sku: "SAMPLE-CRT-VLV-OLV", stock: 0, images: 2 },
      { colorName: "Blush", colorHex: "#D9A5A0", sku: "SAMPLE-CRT-VLV-BLS", stock: 4, images: 2 },
    ],
  },
  {
    name: "Pearl Drop Earrings",
    slug: "pearl-drop-earrings",
    category: "earrings",
    motif: "earring",
    basePrice: 6800,
    featured: true,
    shortDescription: "Freshwater-style pearl drops on fine hooks.",
    description:
      "Simple, luminous drops that move from desk to dinner. Lightweight enough for all-day wear, with hypoallergenic hooks." +
      SAMPLE_NOTE,
    specifications: [
      { label: "Metal", value: "Plated brass (sample)" },
      { label: "Drop length", value: "3.5 cm (sample)" },
    ],
    variants: [
      { colorName: "Gold", colorHex: "#C8A24A", sku: "SAMPLE-EAR-PRL-GLD", stock: 12, images: 2 },
      { colorName: "Silver", colorHex: "#BFC3C7", sku: "SAMPLE-EAR-PRL-SLV", stock: 9, images: 2 },
    ],
  },
  {
    name: "Hammered Hoop Earrings",
    slug: "hammered-hoop-earrings",
    category: "earrings",
    motif: "earring",
    basePrice: 5400,
    shortDescription: "Hand-hammered hoops with a soft, textured shine.",
    description: "Medium hoops with a hand-hammered finish that catches the light." + SAMPLE_NOTE,
    specifications: [{ label: "Diameter", value: "30 mm (sample)" }],
    variants: [{ colorName: "Gold", colorHex: "#C8A24A", sku: "SAMPLE-EAR-HOP-GLD", stock: 15, images: 3 }],
  },
  {
    name: "Silk Wrap Dress",
    slug: "silk-wrap-dress",
    category: "clothing",
    motif: "dress",
    basePrice: 24000,
    shortDescription: "A fluid wrap dress in washable silk.",
    description: "A flattering wrap silhouette with a tie waist and fluttering sleeves." + SAMPLE_NOTE,
    specifications: [
      { label: "Material", value: "Washable silk (sample)" },
      { label: "Fit", value: "True to size" },
    ],
    variants: [
      { colorName: "Black", colorHex: "#1C1B1A", sku: "SAMPLE-DRS-SLK-BLK", stock: 4, images: 2 },
      { colorName: "Terracotta", colorHex: "#B5562F", sku: "SAMPLE-DRS-SLK-TER", stock: 3, images: 2 },
    ],
  },
  {
    name: "Woven Market Tote",
    slug: "woven-market-tote",
    category: "accessories",
    motif: "tote",
    basePrice: 7200,
    shortDescription: "A roomy hand-woven tote with leather handles.",
    description: "Hand-woven and sturdy, sized for market days and weekends away." + SAMPLE_NOTE,
    specifications: [{ label: "Size", value: "45 × 35 × 15 cm (sample)" }],
    variants: [{ colorName: "Natural", colorHex: "#C9B48A", sku: "SAMPLE-TOT-NAT", stock: 6, images: 2 }],
  },
];

async function storeImage(buffer: Buffer, storageKey: string) {
  const processed = await processAndStoreImage(storage(), buffer, storageKey);
  return { ...processed, url: imageUrls(storage(), storageKey, processed.widths)!.src };
}

async function mediaAsset(buffer: Buffer) {
  const storageKey = `media/${randomUUID()}`;
  const processed = await storeImage(buffer, storageKey);
  await prisma.mediaAsset.create({ data: { storageKey, status: "READY", widths: processed.widths, url: processed.url } });
  return { storageKey, url: processed.url };
}

async function resetCatalog() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset data in production.");
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.updateMany({ data: { parentId: null } });
  await prisma.category.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await storage().deletePrefix("products/");
  await storage().deletePrefix("media/");
}

async function main() {
  if (process.env.SEED_RESET === "true") {
    console.log("Resetting catalog data…");
    await resetCatalog();
  } else if ((await prisma.product.count()) > 0) {
    console.log("Catalog already has products; skipping seed. Run with SEED_RESET=true to start over (development only).");
    return;
  }

  console.log("Seeding store settings…");
  await prisma.storeSettings.upsert({
    where: { id: "store" },
    update: {},
    create: {
      id: "store",
      storeName: "Sample Boutique",
      tagline: "Placeholder tagline — set your own in Admin › Settings",
      currency: "USD",
      contactEmail: "hello@example.com",
      contactPhone: "+1 (555) 010-0000",
      address: "123 Sample Street, Your City",
      storeDescription: "This is sample store information. Replace it with your boutique's details.",
      brandStoryTitle: "Our story (sample)",
      brandStory:
        "This section tells your brand story: who you are, where your pieces come from, and the care that goes into them. Replace this sample text in Admin › Settings.",
      announcement: "Sample store data — free shipping over $150 (example policy)",
      announcementActive: true,
      socialLinks: { instagram: "https://instagram.com/", pinterest: "https://pinterest.com/" },
      shippingPolicy: "Sample shipping policy. Describe delivery times, carriers and costs here.",
      returnsPolicy: "Sample returns policy. Describe how and when customers can return items.",
      privacyPolicy: "Sample privacy policy. Describe how you collect and use customer data.",
      flatShippingCents: 1200,
      freeShippingThresholdCents: 15000,
      taxRateBasisPoints: 0,
    },
  });

  console.log("Seeding categories…");
  const categoryIds = new Map<string, string>();
  for (const [index, c] of categories.entries()) {
    const image = await mediaAsset(
      await placeholderImage({ motif: "category", color: c.color, label: c.name, width: 1200, height: 1500 }),
    );
    const created = await prisma.category.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        parentId: c.parent ? categoryIds.get(c.parent) : null,
        isFeatured: Boolean(c.featured),
        sortOrder: index,
        imageKey: image.storageKey,
        imageUrl: image.url,
      },
    });
    categoryIds.set(c.slug, created.id);
  }

  for (const [pIndex, p] of products.entries()) {
    console.log(`Seeding ${p.name}…`);
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        categoryId: categoryIds.get(p.category)!,
        basePriceCents: p.basePrice,
        salePriceCents: p.salePrice ?? null,
        currency: "USD",
        status: "PUBLISHED",
        publishedAt: new Date(Date.now() - (products.length - pIndex) * 86_400_000),
        isFeatured: Boolean(p.featured),
        sortOrder: pIndex,
        shortDescription: p.shortDescription,
        description: p.description,
        specifications: p.specifications,
        seoTitle: `${p.name} (sample)`,
        seoDescription: p.shortDescription,
      },
    });

    for (const [vIndex, v] of p.variants.entries()) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          colorName: v.colorName,
          colorHex: v.colorHex,
          sku: v.sku,
          stock: v.stock,
          priceCents: v.price ?? null,
          salePriceCents: v.salePrice ?? null,
          sortOrder: vIndex,
        },
      });
      for (let i = 0; i < v.images; i++) {
        const storageKey = `products/${product.id}/${randomUUID()}`;
        const buffer = await placeholderImage({
          motif: p.motif,
          color: v.colorHex,
          variation: i,
          label: `${p.name} — ${v.colorName}`,
          sublabel: `SAMPLE IMAGE ${i + 1} OF ${v.images} · ${v.colorName.toUpperCase()}`,
        });
        const stored = await storeImage(buffer, storageKey);
        await prisma.productImage.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            status: "READY",
            storageKey,
            url: stored.url,
            widths: stored.widths,
            width: stored.width,
            height: stored.height,
            altText: `${p.name} in ${v.colorName}, view ${i + 1} (sample image)`,
            sortOrder: i,
            isPrimary: i === 0,
          },
        });
      }
    }

    for (const [i, shared] of (p.sharedImages ?? []).entries()) {
      const storageKey = `products/${product.id}/${randomUUID()}`;
      const stored = await storeImage(
        await placeholderImage({ motif: p.motif, color: shared.color, variation: 2, label: shared.label, sublabel: "SAMPLE SHARED IMAGE · ALL COLOURS" }),
        storageKey,
      );
      await prisma.productImage.create({
        data: {
          productId: product.id,
          variantId: null,
          status: "READY",
          storageKey,
          url: stored.url,
          widths: stored.widths,
          width: stored.width,
          height: stored.height,
          altText: `${p.name}: ${shared.label} (sample image)`,
          sortOrder: i,
          isPrimary: i === 0,
        },
      });
    }

    const variants = await prisma.productVariant.findMany({ where: { productId: product.id, isActive: true } });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        minPriceCents: minimumPrice(product, variants),
        totalStock: variants.reduce((n, v) => n + v.stock, 0),
      },
    });
  }

  console.log("Seeding banners…");
  const hero = await mediaAsset(
    await placeholderImage({ motif: "hero", color: "#A8874A", label: "Sample hero image", sublabel: "REPLACE IN ADMIN › BANNERS", width: 2400, height: 1200 }),
  );
  await prisma.banner.create({
    data: {
      placement: "HERO",
      title: "Timeless pieces, softly made",
      subtitle: "Sample hero banner — edit the headline, image and button in Admin › Banners.",
      ctaLabel: "Shop the collection",
      ctaHref: "/shop",
      imageKey: hero.storageKey,
      imageUrl: hero.url,
      altText: "Sample hero banner artwork",
    },
  });
  const promos = [
    { title: "The Pashmina Edit", subtitle: "Sample promotion for the shawls collection.", href: "/category/pashmina", color: "#7A1F35" },
    { title: "Dress your windows", subtitle: "Sample promotion for curtains.", href: "/category/curtains", color: "#B8A68A" },
  ];
  for (const [i, promo] of promos.entries()) {
    const img = await mediaAsset(
      await placeholderImage({ motif: "hero", color: promo.color, label: promo.title, sublabel: "SAMPLE PROMOTION", width: 1600, height: 1000, variation: i }),
    );
    await prisma.banner.create({
      data: {
        placement: "PROMO",
        title: promo.title,
        subtitle: promo.subtitle,
        ctaLabel: "Explore",
        ctaHref: promo.href,
        imageKey: img.storageKey,
        imageUrl: img.url,
        altText: `${promo.title} sample artwork`,
        sortOrder: i,
      },
    });
  }

  console.log("Done. Create an administrator with: npm run admin:create");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
