import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for containers and load balancers. Reveals nothing beyond up/down. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
