import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";
import { SLUG_PATTERN } from "@/lib/slug";

export const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

/** Trimmed optional text; empty strings become null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const requiredText = (max: number, label = "This field") =>
  z.string().trim().min(1, `${label} is required`).max(max, `Must be ${max} characters or fewer`);

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(80)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens");

/** Money entered as a decimal string ("49.99") converted to integer cents. */
export const moneyRequired = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const cents = typeof v === "number" ? Math.round(v * 100) : parseMoneyToCents(v);
    if (cents == null || Number.isNaN(cents)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount, e.g. 49.99" });
      return z.NEVER;
    }
    return cents;
  })
  .pipe(z.number().int().min(0).max(100_000_000, "Amount is too large"));

export const moneyOptional = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === "") return null;
    const cents = typeof v === "number" ? Math.round(v * 100) : parseMoneyToCents(v);
    if (cents == null) return null;
    if (Number.isNaN(cents)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount, e.g. 49.99" });
      return z.NEVER;
    }
    return cents;
  })
  .pipe(z.number().int().min(0).max(100_000_000).nullable());

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean(), z.null()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v == null || /^https?:\/\//i.test(v), "Must start with http:// or https://");

/** Internal path ("/shop") or absolute http(s) URL. Rejects javascript: and other schemes. */
export const linkHref = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v == null || /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v), "Use a path like /shop or a full https:// link");

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  return out;
}
