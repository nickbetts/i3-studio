"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { approvals, documents } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export async function decideDocument(documentId: string, decision: "approved" | "changes_requested", note: string): Promise<void> {
  const user = await requireClientUser();
  const document = await db.query.documents.findFirst({ where: and(eq(documents.id, documentId), eq(documents.clientAccountId, user.clientAccountId)) });
  if (!document) return;
  await db.update(documents).set({ status: decision }).where(eq(documents.id, documentId));
  await db.insert(approvals).values({ documentId, clientAccountId: user.clientAccountId, decidedByUserId: user.id, decision, note: note.trim() || null });
  await auditLog({ actorUserId: user.id, action: `document.${decision}`, entityType: "document", entityId: documentId, clientAccountId: user.clientAccountId, metadata: { note: note.trim() } });
  revalidatePath("/portal/approvals");
  revalidatePath("/portal");
}
