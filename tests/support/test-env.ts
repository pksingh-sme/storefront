// Environment for integration tests. Uses a separate database so tests never touch dev data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://storefront:storefront@localhost:5432/storefront_test?schema=public";

export function applyTestEnv() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-0123";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = "./.test-storage";
  process.env.UPLOAD_SIGNING_SECRET ??= "test-upload-secret-test-upload-secret-01";
  process.env.SITE_URL = "http://localhost:3000";
}
