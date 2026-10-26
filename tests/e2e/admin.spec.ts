import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, login, png } from "./helpers";

test.describe("admin access control", () => {
  test("redirects anonymous visitors to the login page", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expectNoSeriousA11yViolations(page);
  });

  test("rejects wrong credentials with a generic message", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("e2e-admin@example.com");
    await page.getByLabel("Password").fill("not-the-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("login-error")).toHaveText("Incorrect email or password.");
  });

  test("protected endpoints refuse unauthenticated requests", async ({ request, baseURL }) => {
    const upload = await request.post("/api/uploads/local", { headers: { origin: baseURL! }, multipart: { token: "x" } });
    expect(upload.status()).toBe(401);
    const crossSite = await request.post("/api/uploads/local", { headers: { origin: "https://evil.example" }, multipart: { token: "x" } });
    expect(crossSite.status()).toBe(403);
    const signUp = await request.post("/api/auth/sign-up/email", {
      headers: { origin: baseURL!, "content-type": "application/json" },
      data: { email: "x@example.com", password: "a-long-password-123", name: "x" },
    });
    expect(signUp.status()).toBeGreaterThanOrEqual(400);
    // Raw uploads are never publicly served.
    expect((await request.get("/media/uploads/anything.png")).status()).toBe(404);
  });
});

test.describe("product management", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("create a product with two colours and colour-specific galleries, publish it and see it in the store", async ({ page }) => {
    const name = `E2E Silk Scarf ${Date.now()}`;
    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill(name);
    await page.getByLabel("Category").selectOption({ label: "Accessories" });
    await page.getByLabel("Base price").fill("89.00");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("Draft created")).toBeVisible();
    const productUrl = page.url();

    // Details
    await page.getByLabel("Short description").fill("A light silk scarf for testing.");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();

    // Colours: Ruby (own price) and Sapphire
    const addColour = page.getByRole("form", { name: "Add a colour" });
    await addColour.getByLabel("Colour name").fill("Ruby");
    await addColour.locator('input[name="colorHex"]').fill("#9B111E");
    await addColour.getByLabel("SKU").fill(`E2E-RUBY-${Date.now()}`);
    await addColour.getByLabel("Stock").fill("4");
    await addColour.getByLabel("Price override").fill("95.00");
    await addColour.getByRole("button", { name: "Add colour" }).click();
    await expect(page.getByTestId("variant-row").filter({ hasText: "Ruby" })).toBeVisible();

    await addColour.getByLabel("Colour name").fill("Sapphire");
    await addColour.locator('input[name="colorHex"]').fill("#0F52BA");
    await addColour.getByLabel("SKU").fill(`E2E-SAPH-${Date.now()}`);
    await addColour.getByLabel("Stock").fill("6");
    await addColour.getByRole("button", { name: "Add colour" }).click();
    await expect(page.getByTestId("variant-row").filter({ hasText: "Sapphire" })).toBeVisible();

    // Publishing is blocked until images exist.
    await page.getByTestId("publish-button").click();
    await expect(page.getByText(/can't be published yet/)).toBeVisible();

    // Images: two for Ruby, one for Sapphire
    const ruby = page.locator('[data-testid^="gallery-"]').filter({ has: page.getByRole("heading", { name: "Ruby" }) });
    await ruby.locator('input[type="file"]').setInputFiles([
      { name: "ruby-1.png", mimeType: "image/png", buffer: await png("#9B111E", "RUBY 1") },
      { name: "ruby-2.png", mimeType: "image/png", buffer: await png("#7A0D18", "RUBY 2") },
    ]);
    await expect(ruby.getByTestId("pending-upload")).toHaveCount(2);
    await ruby.getByRole("button", { name: "Upload 2 images" }).click();
    await expect(ruby.getByTestId("admin-image")).toHaveCount(2, { timeout: 20_000 });

    const sapphire = page.locator('[data-testid^="gallery-"]').filter({ has: page.getByRole("heading", { name: "Sapphire" }) });
    await sapphire.locator('input[type="file"]').setInputFiles([{ name: "sapphire.png", mimeType: "image/png", buffer: await png("#0F52BA", "SAPPHIRE") }]);
    await sapphire.getByRole("button", { name: "Upload 1 image" }).click();
    await expect(sapphire.getByTestId("admin-image")).toHaveCount(1, { timeout: 20_000 });

    // Invalid uploads are rejected: wrong type in the browser, fake content on the server.
    await sapphire.locator('input[type="file"]').setInputFiles([{ name: "notes.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") }]);
    await expect(sapphire.getByText("Only JPEG, PNG, WebP or AVIF images are allowed.")).toBeVisible();
    await sapphire.getByRole("button", { name: "Remove" }).first().click();
    await sapphire.locator('input[type="file"]').setInputFiles([{ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not really an image") }]);
    await sapphire.getByRole("button", { name: "Upload 1 image" }).click();
    await expect(sapphire.getByText(/content does not match|not a supported image/)).toBeVisible();
    await expect(sapphire.getByTestId("admin-image")).toHaveCount(1);

    // Make Ruby's second image the main image.
    const rubySecond = ruby.getByTestId("admin-image").nth(1);
    const rubySecondId = await rubySecond.getAttribute("data-image-id");
    await rubySecond.getByRole("button", { name: "Set as main" }).click();
    await expect(ruby.getByTestId("admin-image").first()).toHaveAttribute("data-image-id", rubySecondId!);

    // Customer preview reflects the colour galleries before publishing.
    const preview = page.locator("section", { has: page.getByRole("heading", { name: "Customer preview" }) });
    await preview.getByRole("radio", { name: "Sapphire" }).click();
    await expect(preview.getByTestId("variant-sku")).toContainText("E2E-SAPH");

    await page.getByTestId("publish-button").click();
    await expect(page.getByTestId("product-status")).toHaveText("Published");

    // Storefront
    const slug = (await page.getByLabel("URL slug").inputValue()).trim();
    await page.goto(`/product/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByTestId("selected-color")).toHaveText("Ruby");
    await expect(page.getByTestId("product-price")).toContainText("$95.00");
    await expect(page.getByTestId("gallery-main-image")).toHaveAttribute("data-image-id", rubySecondId!);
    await expect(page.getByTestId("gallery-thumbnail")).toHaveCount(2);
    await page.getByRole("radio", { name: "Sapphire" }).click();
    await expect(page.getByTestId("product-price")).toContainText("$89.00");
    await expect(page.getByTestId("gallery-thumbnail")).toHaveCount(0); // single image, no thumbnails
    await expect(page.getByTestId("gallery-main-image")).not.toHaveAttribute("data-image-id", rubySecondId!);

    // Unpublish hides it again.
    await page.goto(productUrl);
    await page.getByTestId("unpublish-button").click();
    await expect(page.getByTestId("product-status")).toHaveText("Draft");
    const res = await page.goto(`/product/${slug}`);
    expect(res?.status()).toBe(404);
  });

  test("edit a colour's stock and price and see it in the store", async ({ page }) => {
    await page.goto("/admin/products?q=hammered");
    await page.getByRole("link", { name: "Hammered Hoop Earrings", exact: true }).click();
    const row = page.getByTestId("variant-row").filter({ hasText: "Gold" });
    await row.getByRole("button", { name: /Edit/ }).click();
    await row.getByLabel("Stock").fill("0");
    await row.getByLabel("Price override").fill("49.00");
    await row.getByRole("button", { name: "Save colour" }).click();
    await expect(row.getByText("Out of stock")).toBeVisible();

    await page.goto("/product/hammered-hoop-earrings");
    await expect(page.getByTestId("product-price")).toContainText("$49.00");
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();
  });

  test("dashboard and admin pages are accessible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total products")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.goto("/admin/settings");
    await expect(page.getByLabel("Store name")).toHaveValue("Sample Boutique");
  });
});
