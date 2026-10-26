import { describe, expect, it } from "vitest";
import { signUploadToken, verifyUploadToken } from "@/lib/storage/signing";
import { cartAddSchema, newsletterSchema, productInputSchema, variantInputSchema } from "@/lib/validation/catalog";
import { linkHref } from "@/lib/validation/common";
import { sniffImageType, uploadRequestSchema } from "@/lib/validation/upload";

describe("product validation", () => {
  const base = { name: "Shawl", slug: "shawl", categoryId: "cat1", basePrice: "100.00" };
  it("accepts a valid product and converts prices to cents", () => {
    const r = productInputSchema.parse({ ...base, salePrice: "80", specifications: "Material: Wool\nSize: 200 x 70" });
    expect(r.basePrice).toBe(10000);
    expect(r.salePrice).toBe(8000);
    expect(r.specifications).toEqual([
      { label: "Material", value: "Wool" },
      { label: "Size", value: "200 x 70" },
    ]);
  });
  it("rejects a sale price above the base price", () => {
    expect(productInputSchema.safeParse({ ...base, salePrice: "120" }).success).toBe(false);
  });
  it("rejects malformed slugs", () => {
    expect(productInputSchema.safeParse({ ...base, slug: "Bad Slug!" }).success).toBe(false);
  });
  it("ignores fields that are not part of the form (no mass assignment)", () => {
    const r = productInputSchema.parse({ ...base, status: "PUBLISHED", minPriceCents: 1, id: "hack" });
    expect(r).not.toHaveProperty("status");
    expect(r).not.toHaveProperty("minPriceCents");
    expect(r).not.toHaveProperty("id");
  });
});

describe("variant validation", () => {
  const base = { colorName: "Burgundy", sku: "psh-bur", stock: "5", isActive: "on" };
  it("normalises SKU and hex colour", () => {
    const r = variantInputSchema.parse({ ...base, colorHex: "#7a1f35" });
    expect(r.sku).toBe("PSH-BUR");
    expect(r.colorHex).toBe("#7A1F35");
    expect(r.isActive).toBe(true);
  });
  it("rejects negative stock and invalid hex", () => {
    expect(variantInputSchema.safeParse({ ...base, stock: "-1" }).success).toBe(false);
    expect(variantInputSchema.safeParse({ ...base, colorHex: "red" }).success).toBe(false);
  });
});

describe("upload validation", () => {
  const schema = uploadRequestSchema(10 * 1024 * 1024);
  it("rejects disallowed types and oversize files", () => {
    expect(schema.safeParse({ fileName: "a.gif", contentType: "image/gif", size: 100 }).success).toBe(false);
    expect(schema.safeParse({ fileName: "a.svg", contentType: "image/svg+xml", size: 100 }).success).toBe(false);
    expect(schema.safeParse({ fileName: "a.jpg", contentType: "image/jpeg", size: 11 * 1024 * 1024 }).success).toBe(false);
    expect(schema.safeParse({ fileName: "a.jpg", contentType: "image/jpeg", size: 0 }).success).toBe(false);
    expect(schema.safeParse({ fileName: "a.jpg", contentType: "image/jpeg", size: 1000 }).success).toBe(true);
  });
  it("detects image types from magic bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("MZ executable"))).toBeNull();
  });
  it("signs upload tokens and rejects tampering or expiry", () => {
    const secret = "s".repeat(32);
    const token = signUploadToken({ key: "uploads/a.png", contentType: "image/png", maxBytes: 10, exp: Date.now() + 1000 }, secret);
    expect(verifyUploadToken(token, secret)?.key).toBe("uploads/a.png");
    expect(verifyUploadToken(token, "x".repeat(32))).toBeNull();
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ key: "products/evil", contentType: "image/png", maxBytes: 1e9, exp: Date.now() + 1000 })).toString("base64url");
    expect(verifyUploadToken(`${forged}.${sig}`, secret)).toBeNull();
    expect(verifyUploadToken(`${payload}.${sig}`, secret, Date.now() + 5000)).toBeNull();
  });
});

describe("public input validation", () => {
  it("requires newsletter consent and a valid email", () => {
    expect(newsletterSchema.safeParse({ email: "a@b.co", consent: "on" }).success).toBe(true);
    expect(newsletterSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ email: "nope", consent: "on" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ email: "a@b.co", consent: "on", company: "bot" }).success).toBe(false);
  });
  it("only accepts sane cart quantities and ids", () => {
    expect(cartAddSchema.safeParse({ variantId: "abc", quantity: 0 }).success).toBe(false);
    expect(cartAddSchema.safeParse({ variantId: "abc", quantity: 100 }).success).toBe(false);
    expect(cartAddSchema.safeParse({ variantId: "abc'; drop table", quantity: 1 }).success).toBe(false);
    expect(cartAddSchema.safeParse({ variantId: "abc", quantity: 2, priceCents: 1 }).data).toEqual({ variantId: "abc", quantity: 2 });
  });
  it("rejects javascript: links in banners", () => {
    expect(linkHref.safeParse("javascript:alert(1)").success).toBe(false);
    expect(linkHref.safeParse("//evil.example").success).toBe(false);
    expect(linkHref.safeParse("/shop").success).toBe(true);
    expect(linkHref.safeParse("https://example.com").success).toBe(true);
  });
});
