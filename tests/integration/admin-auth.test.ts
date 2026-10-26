import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Simulated request context: the cookie header the "browser" sends.
const request = vi.hoisted(() => ({ cookie: "" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(request.cookie ? { cookie: request.cookie } : {}),
  cookies: async () => ({ get: () => undefined, set: () => undefined, getAll: () => [], delete: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { auth } = await import("@/lib/auth");
const { prisma } = await import("@/lib/db");
const actions = await import("@/app/admin/actions");
const { resetDb, makeCategory } = await import("../support/factories");

const PASSWORD = "correct-horse-battery-staple";

async function createUser(email: string, role: string) {
  const id = randomUUID();
  await prisma.user.create({ data: { id, email, name: email, role, emailVerified: true } });
  await prisma.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(PASSWORD) } });
}

async function signIn(email: string, password = PASSWORD) {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true, headers: new Headers({ origin: "http://localhost:3000" }) });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, cookie: setCookie.map((c) => c.split(";")[0]).join("; ") };
}

async function draftProduct() {
  const category = await makeCategory();
  return prisma.product.create({ data: { name: "Secret draft", slug: "secret-draft", categoryId: category.id, basePriceCents: 1000 } });
}

beforeEach(async () => {
  await resetDb();
  request.cookie = "";
  await createUser("owner@test.local", "admin");
  await createUser("customer@test.local", "user");
});

describe("admin authentication", () => {
  it("signs in an administrator with the correct password", async () => {
    const { status, cookie } = await signIn("owner@test.local");
    expect(status).toBe(200);
    expect(cookie).toMatch(/better-auth\.session_token=/);
  });

  it("rejects a wrong password", async () => {
    const { status } = await signIn("owner@test.local", "wrong-password-123");
    expect(status).toBe(401);
  });

  it("does not allow public sign-up", async () => {
    const res = await auth.api.signUpEmail({
      body: { email: "intruder@test.local", password: "intruder-password-1", name: "x" },
      asResponse: true,
      headers: new Headers({ origin: "http://localhost:3000" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.count({ where: { email: "intruder@test.local" } })).toBe(0);
  });
});

describe("server-side authorization of admin actions", () => {
  it("rejects every protected action without a session and changes nothing", async () => {
    const product = await draftProduct();
    const results = await Promise.all([
      actions.setProductStatusAction(product.id, "PUBLISHED"),
      actions.deleteProductAction(product.id),
      actions.duplicateProductAction(product.id),
      actions.requestImageUploadAction(product.id, null, { fileName: "a.png", contentType: "image/png", size: 10 }),
      actions.requestMediaUploadAction({ fileName: "a.png", contentType: "image/png", size: 10 }),
      actions.deleteCategoryAction(product.categoryId, null),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/signed in as an administrator/) });

    const fd = new FormData();
    fd.set("colorName", "Red");
    fd.set("sku", "RED-1");
    fd.set("stock", "1");
    expect(await actions.createVariantAction(product.id, null, fd)).toMatchObject({ ok: false });

    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ status: "DRAFT" });
    expect(await prisma.productVariant.count()).toBe(0);
    expect(await prisma.productImage.count()).toBe(0);
    expect(await prisma.product.count()).toBe(1);
  });

  it("rejects signed-in users who are not administrators", async () => {
    const product = await draftProduct();
    request.cookie = (await signIn("customer@test.local")).cookie;
    expect(await actions.deleteProductAction(product.id)).toMatchObject({ ok: false });
    expect(await prisma.product.count()).toBe(1);
  });

  it("rejects a forged session cookie", async () => {
    const product = await draftProduct();
    request.cookie = "better-auth.session_token=forged.value";
    expect(await actions.deleteProductAction(product.id)).toMatchObject({ ok: false });
  });

  it("allows an administrator and records an audit log entry", async () => {
    const product = await draftProduct();
    request.cookie = (await signIn("owner@test.local")).cookie;
    const fd = new FormData();
    fd.set("colorName", "Burgundy");
    fd.set("sku", "SD-BUR");
    fd.set("stock", "4");
    fd.set("isActive", "on");
    expect(await actions.createVariantAction(product.id, null, fd)).toMatchObject({ ok: true });
    expect(await prisma.productVariant.count({ where: { productId: product.id } })).toBe(1);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "variant.create" }, include: { actor: true } });
    expect(log.actor?.email).toBe("owner@test.local");
  });
});
