import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import sharp from "sharp";

export const ADMIN = { email: "e2e-admin@example.com", password: "e2e-admin-password-123" };

export async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

export async function png(color: string, label = "") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="100%" height="100%" fill="${color}"/><text x="40" y="120" font-size="60" fill="#fff">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
}
