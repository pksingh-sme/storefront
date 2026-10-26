import { execSync } from "node:child_process";
import { E2E_DATABASE_URL } from "../../playwright.config";

export const E2E_ADMIN = { email: "e2e-admin@example.com", password: "e2e-admin-password-123" };

/** Resets the e2e database: migrations, sample catalog and one administrator. */
export default function globalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL: E2E_DATABASE_URL,
    STORAGE_DRIVER: "local",
    LOCAL_STORAGE_DIR: "./.e2e-storage",
    UPLOAD_SIGNING_SECRET: "e2e-upload-secret-e2e-upload-secret-0001",
    SEED_RESET: "true",
    ADMIN_PASSWORD: E2E_ADMIN.password,
  };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  const truncate = `TRUNCATE "AuditLog","OrderItem","Order","NewsletterSubscriber","session","account","user" CASCADE`;
  execSync(
    `node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query(process.argv[1])).then(()=>c.end())" '${truncate}'`,
    { stdio: "inherit", env },
  );
  execSync("npm run -s db:seed", { stdio: "inherit", env });
  execSync(`npm run -s admin:create -- --email ${E2E_ADMIN.email} --name "E2E Admin"`, { stdio: "inherit", env });
}
