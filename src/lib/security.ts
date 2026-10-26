import type { NextRequest } from "next/server";

/**
 * CSRF defence for route handlers that change state: the Origin (or Referer) header
 * must match this site. Server actions get the same check from Next.js automatically.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  try {
    const expected = new URL(process.env.SITE_URL || request.nextUrl.origin);
    const actual = new URL(origin);
    return actual.host === expected.host || actual.host === request.nextUrl.host;
  } catch {
    return false;
  }
}
