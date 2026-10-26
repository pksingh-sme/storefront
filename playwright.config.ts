import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://storefront:storefront@localhost:5432/storefront_e2e?schema=public";

const serverEnv = {
  DATABASE_URL: E2E_DATABASE_URL,
  SITE_URL: baseURL,
  BETTER_AUTH_URL: baseURL,
  BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-01",
  STORAGE_DRIVER: "local",
  LOCAL_STORAGE_DIR: "./.e2e-storage",
  UPLOAD_SIGNING_SECRET: "e2e-upload-secret-e2e-upload-secret-0001",
  NEXT_DIST_DIR: ".next-e2e",
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    // Builds once and serves the production bundle against the dedicated e2e database.
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: serverEnv,
  },
});
