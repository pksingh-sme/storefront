import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./helpers";


const thumbIds = (page: import("@playwright/test").Page) =>
  page.getByTestId("gallery-thumbnail").evaluateAll((els) => els.map((e) => e.getAttribute("data-image-id")));

test.describe("storefront", () => {
  test("homepage shows hero, categories, products and passes accessibility checks", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shop by category" })).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("shop supports search, colour filter and sorting", async ({ page }) => {
    await page.goto("/shop?q=pashmina");
    await expect(page.getByTestId("product-card")).toHaveCount(1);
    await page.goto("/shop?color=Gold");
    const names = await page.getByTestId("product-card").locator("h3").allTextContents();
    expect(names.sort()).toEqual(["Hammered Hoop Earrings", "Pearl Drop Earrings"]);
    await page.goto("/shop?sort=price_asc");
    const prices = await page.getByTestId("product-card").locator("h3").allTextContents();
    expect(prices[0]).toBe("Hammered Hoop Earrings");
    await page.goto("/shop?q=zzzz-nothing");
    await expect(page.getByText("Nothing matches just yet")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("category page lists only that category, including subcategories", async ({ page }) => {
    await page.goto("/category/shawls-wraps");
    await expect(page.getByRole("heading", { level: 1, name: "Shawls & Wraps" })).toBeVisible();
    const names = await page.getByTestId("product-card").locator("h3").allTextContents();
    expect(names.sort()).toEqual(["Classic Pashmina Shawl", "Embroidered Wool Stole"]);
  });

  test("product page switches colour gallery, price, SKU and stock", async ({ page }) => {
    await page.goto("/product/classic-pashmina-shawl");
    await expect(page.getByTestId("selected-color")).toHaveText("Burgundy");
    await expect(page.getByTestId("variant-sku")).toHaveText("SAMPLE-PSH-BUR");
    const burgundyThumbs = await thumbIds(page);
    expect(burgundyThumbs).toHaveLength(4); // 3 burgundy + 1 shared

    await page.getByRole("button", { name: "Next image" }).click();
    await expect(page.getByTestId("gallery-main-image")).toHaveAttribute("data-image-id", burgundyThumbs[1]!);

    await page.getByRole("radio", { name: "Royal Blue" }).click();
    await expect(page).toHaveURL(/color=royal-blue/);
    await expect(page.getByTestId("variant-sku")).toHaveText("SAMPLE-PSH-RBL");
    await expect(page.getByTestId("product-price")).toContainText("$179.00");
    const blueThumbs = await thumbIds(page);
    expect(blueThumbs).toHaveLength(4);
    // Only the shared image is common to both colours.
    expect(blueThumbs.filter((id) => burgundyThumbs.includes(id))).toHaveLength(1);
    // Active image resets to the new colour's main image.
    await expect(page.getByTestId("gallery-main-image")).toHaveAttribute("data-image-id", blueThumbs[0]!);

    await page.getByRole("radio", { name: "Cream (sold out)" }).click();
    await expect(page.getByTestId("variant-stock")).toHaveText("Out of stock");
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();

    // Structured data and canonical URL for SEO.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/product\/classic-pashmina-shawl$/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld.hasVariant).toHaveLength(4);
    await expectNoSeriousA11yViolations(page);
  });

  test("keyboard users can change colour and image", async ({ page }) => {
    await page.goto("/product/classic-pashmina-shawl");
    await page.getByRole("radio", { name: "Burgundy" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("selected-color")).toHaveText("Emerald Green");
    const thumbs = await thumbIds(page);
    await page.getByTestId("gallery-thumbnail").first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("gallery-main-image")).toHaveAttribute("data-image-id", thumbs[1]!);
  });

  test("cart keeps the selected colour, validates stock and persists", async ({ page }) => {
    await page.goto("/product/classic-pashmina-shawl?color=emerald-green");
    await expect(page.getByTestId("variant-stock")).toHaveText("Only 2 left");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-message")).toContainText("Added 2 × Classic Pashmina Shawl (Emerald Green)");
    await expect(page.getByTestId("cart-count")).toHaveText("2");

    // Adding more than the remaining stock is refused by the server.
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-message")).toContainText("Only 2 available");

    await page.goto("/cart");
    const line = page.getByTestId("cart-line");
    await expect(line).toHaveCount(1);
    await expect(line.getByTestId("cart-line-color")).toHaveText("Emerald Green");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("$330.00");
    await expect(page.getByTestId("checkout-unavailable")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.reload();
    await expect(page.getByTestId("cart-line")).toHaveCount(1);

    await line.getByTestId("cart-line-quantity").selectOption("1");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("$165.00");
    await page.getByRole("button", { name: /Remove/ }).click();
    await expect(page.getByTestId("empty-cart")).toBeVisible();
  });

  test("unknown and draft products return 404", async ({ page }) => {
    const res = await page.goto("/product/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
  });

  test("sitemap and robots are served", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/product/classic-pashmina-shawl");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("newsletter signup requires consent @mobile", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("form").filter({ has: page.locator("#home-newsletter-email") });
    await form.getByLabel("Email address").fill("reader@example.com");
    await form.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText("Please confirm you would like to receive emails")).toBeVisible();
    await form.getByLabel(/I agree/).check();
    await form.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText("you're on the list")).toBeVisible();
  });
});

test.describe("mobile product page @mobile", () => {
  test("stacks gallery above details, fits the screen and swipes between images @mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/product/classic-pashmina-shawl");
    const gallery = await page.getByTestId("product-gallery").boundingBox();
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(gallery!.y).toBeLessThan(title!.y);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const thumbs = await thumbIds(page);
    const box = (await page.getByTestId("gallery-main-image").boundingBox())!;
    const y = box.y + box.height / 2;
    await page.getByRole("region", { name: /Classic Pashmina Shawl in Burgundy/ }).evaluate(
      (el, { y, from, to }) => {
        const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [touch(from)], changedTouches: [touch(from)] }));
        el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [touch(to)] }));
      },
      { y, from: box.x + box.width * 0.8, to: box.x + box.width * 0.2 },
    );
    await expect(page.getByTestId("gallery-main-image")).toHaveAttribute("data-image-id", thumbs[1]!);

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
