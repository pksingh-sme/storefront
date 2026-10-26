import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Db, Tx } from "@/lib/db";

export async function audit(
  db: Db | Tx,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, details } });
}
