"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { allocations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const allocationSchema = z.object({ memberUserId: z.string().min(1), title: z.string().trim().min(2), date: z.string().min(10), startMinute: z.coerce.number().int().min(0).max(1439), endMinute: z.coerce.number().int().min(1).max(1440) });

export async function createAllocation(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const parsed = allocationSchema.safeParse({ memberUserId: formData.get("memberUserId"), title: formData.get("title"), date: formData.get("date"), startMinute: formData.get("startMinute"), endMinute: formData.get("endMinute") });
  if (!parsed.success || parsed.data.endMinute <= parsed.data.startMinute) return;
  const [allocation] = await db.insert(allocations).values({ memberUserId: parsed.data.memberUserId, title: parsed.data.title, date: new Date(`${parsed.data.date}T12:00:00`), startMinute: parsed.data.startMinute, endMinute: parsed.data.endMinute, createdByUserId: actor.id }).returning({ id: allocations.id });
  await auditLog({ actorUserId: actor.id, action: "allocation.created", entityType: "allocation", entityId: allocation.id, metadata: { date: parsed.data.date } });
  revalidatePath("/agency/calendar");
}

export async function deleteAllocation(allocationId: string): Promise<void> {
  const actor = await requireAdmin();
  await db.delete(allocations).where(eq(allocations.id, allocationId));
  await auditLog({ actorUserId: actor.id, action: "allocation.deleted", entityType: "allocation", entityId: allocationId });
  revalidatePath("/agency/calendar");
}
