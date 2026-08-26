import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  clientAccountId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function auditLog(input: AuditInput) {
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    clientAccountId: input.clientAccountId ?? null,
    metadata: input.metadata ?? null,
  });
}
