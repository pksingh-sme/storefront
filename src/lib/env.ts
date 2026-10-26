import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().optional(),
  SITE_URL: z.url().default("http://localhost:3000"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("./storage"),
  UPLOAD_SIGNING_SECRET: z.string().min(32).optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_UPLOAD_ENDPOINT: z.url().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.url().optional(),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(50).default(10),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  // Treat blank values (as left by copying .env.example) as unset.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  const value = parsed.data;
  if (value.STORAGE_DRIVER === "s3" && (!value.S3_BUCKET || !value.S3_REGION || !value.S3_PUBLIC_BASE_URL)) {
    throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET, S3_REGION and S3_PUBLIC_BASE_URL");
  }
  if (value.STORAGE_DRIVER === "local" && !value.UPLOAD_SIGNING_SECRET) {
    throw new Error("STORAGE_DRIVER=local requires UPLOAD_SIGNING_SECRET");
  }
  cached = value;
  return value;
}

export function siteUrl(): string {
  return env().SITE_URL.replace(/\/$/, "");
}

export function paymentsEnabled(): boolean {
  const e = env();
  return Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET);
}
