import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";

export const actor = { id: "", email: "admin@test.local", name: "Test Admin" };

/** Removes all data between tests (test database only). */
export async function resetDb() {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to reset a non-test database");
  await prisma.$executeRawUnsafe(`
    TRUNCATE "AuditLog", "OrderItem", "Order", "CartItem", "Cart", "ProductImage", "ProductVariant", "Product",
      "Category", "Banner", "MediaAsset", "NewsletterSubscriber", "StoreSettings", "session", "account", "verification", "user" CASCADE`);
  const user = await prisma.user.create({ data: { id: randomUUID(), email: actor.email, name: actor.name, role: "admin" } });
  actor.id = user.id;
}

export async function makeCategory(name = "Shawls") {
  return prisma.category.create({ data: { name, slug: `${name.toLowerCase()}-${randomUUID().slice(0, 6)}` } });
}

export async function pngBuffer(color = "#7A1F35", width = 800, height = 1000) {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}
