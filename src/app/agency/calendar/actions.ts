"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { allocations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

const createSchema = z.object({
  memberUserId: z.string().min(1),
  title: z.string().trim().min(2),
  date: z.string().min(10),
  endDate: z.string().min(10).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function createAllocation(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const parsed = createSchema.safeParse({
    memberUserId: formData.get("memberUserId"),
    title: formData.get("title"),
    date: formData.get("date"),
    endDate: formData.get("endDate") || undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return;
  const startMinute = timeToMinutes(parsed.data.startTime);
  const endMinute = timeToMinutes(parsed.data.endTime);
  if (endMinute <= startMinute) return;

  const [allocation] = await db
    .insert(allocations)
    .values({
      memberUserId: parsed.data.memberUserId,
      title: parsed.data.title,
      date: new Date(`${parsed.data.date}T12:00:00`),
      endDate: new Date(`${parsed.data.endDate || parsed.data.date}T12:00:00`),
      startMinute,
      endMinute,
      createdByUserId: actor.id,
    })
    .returning({ id: allocations.id });
  await auditLog({ actorUserId: actor.id, action: "allocation.created", entityType: "allocation", entityId: allocation.id, metadata: { date: parsed.data.date } });
  revalidatePath("/agency/calendar");
}

export async function deleteAllocation(allocationId: string): Promise<void> {
  const actor = await requireAdmin();
  await db.delete(allocations).where(eq(allocations.id, allocationId));
  await auditLog({ actorUserId: actor.id, action: "allocation.deleted", entityType: "allocation", entityId: allocationId });
  revalidatePath("/agency/calendar");
}

type AllocationUpdate = {
  memberUserId?: string;
  title?: string;
  date?: string;
  endDate?: string;
  startMinute?: number;
  endMinute?: number;
};

export async function updateAllocation(allocationId: string, update: AllocationUpdate): Promise<void> {
  const actor = await requireAdmin();
  if (update.startMinute != null && update.endMinute != null && update.endMinute <= update.startMinute) return;
  await db
    .update(allocations)
    .set({
      ...(update.memberUserId ? { memberUserId: update.memberUserId } : {}),
      ...(update.title ? { title: update.title } : {}),
      ...(update.date ? { date: new Date(`${update.date}T12:00:00`) } : {}),
      ...(update.endDate ? { endDate: new Date(`${update.endDate}T12:00:00`) } : {}),
      ...(update.startMinute != null ? { startMinute: update.startMinute } : {}),
      ...(update.endMinute != null ? { endMinute: update.endMinute } : {}),
    })
    .where(eq(allocations.id, allocationId));
  await auditLog({ actorUserId: actor.id, action: "allocation.updated", entityType: "allocation", entityId: allocationId, metadata: { ...update } });
  revalidatePath("/agency/calendar");
}
