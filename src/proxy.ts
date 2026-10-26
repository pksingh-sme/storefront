import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

function originOf(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Content Security Policy built from runtime configuration (storage hosts differ per deployment). */
function contentSecurityPolicy() {
  const dev = process.env.NODE_ENV !== "production";
  const media = originOf(process.env.S3_PUBLIC_BASE_URL);
  const uploadHosts = [
    originOf(process.env.S3_ENDPOINT),
    originOf(process.env.S3_UPLOAD_ENDPOINT),
    process.env.S3_BUCKET && process.env.S3_REGION && !process.env.S3_ENDPOINT
      ? `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`
      : null,
  ].filter(Boolean);
  return [
    "default-src 'self'",
    // Next.js injects inline bootstrapping scripts; 'unsafe-eval' is only needed in development.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${media ? ` ${media}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${uploadHosts.length ? ` ${uploadHosts.join(" ")}` : ""}${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Optimistic redirect only. Every admin page, server action and route handler
  // verifies the session and role on the server as well.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", contentSecurityPolicy());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media/).*)"],
};
