import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const money = z
  .string()
  .optional()
  .transform((v) => {
    const cents = parseMoneyToCents(v);
    return cents == null || Number.isNaN(cents) ? undefined : cents;
  });

const schema = z.object({
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
  category: z.string().trim().max(80).optional().transform((v) => v || undefined),
  min: money,
  max: money,
  instock: z.string().optional().transform((v) => v === "1" || v === "on"),
  color: z.string().trim().max(60).optional().transform((v) => v || undefined),
  sort: z.enum(["featured", "newest", "price_asc", "price_desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type ListingParams = z.infer<typeof schema>;

/** Parses untrusted query parameters, silently dropping anything invalid. */
export function parseListingParams(sp: RawSearchParams): ListingParams {
  const raw = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, first(v)]));
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : { instock: false, min: undefined, max: undefined, q: undefined, category: undefined, color: undefined };
}

export function listingQuery(params: Partial<Record<string, string | number | boolean | undefined>>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === false || v === "") continue;
    sp.set(k, v === true ? "1" : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
