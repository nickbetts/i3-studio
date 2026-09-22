"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clientTypes } from "@/db/schema";
import { requireAgencyPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";

function slugifyKey(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function createClientType(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_client_types");
  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 2) return;
  const key = slugifyKey(label);
  if (!key) return;
  const [row] = await db.insert(clientTypes).values({ key, label }).onConflictDoNothing({ target: clientTypes.key }).returning({ id: clientTypes.id });
  if (!row) return;
  await auditLog({ actorUserId: actor.id, action: "client_type.created", entityType: "client_type", entityId: row.id, metadata: { key, label } });
  revalidatePath("/agency/settings/client-types");
}

export async function setClientTypeArchived(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_client_types");
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (!id) return;
  await db.update(clientTypes).set({ archived }).where(eq(clientTypes.id, id));
  await auditLog({ actorUserId: actor.id, action: archived ? "client_type.archived" : "client_type.restored", entityType: "client_type", entityId: id });
  revalidatePath("/agency/settings/client-types");
}
