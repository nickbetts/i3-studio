"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { allocations } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

// Allocations are tracked in whole/half days. startMinute 0 = morning, 720 = afternoon.
// endMinute 720 = ends midday, 1440 = ends end of day.
const createSchema = z.object({
  memberUserId: z.string().min(1),
  title: z.string().trim().min(2),
  date: z.string().min(10),
  endDate: z.string().min(10).optional(),
  startHalf: z.enum(["am", "pm"]),
  endHalf: z.enum(["midday", "end"]),
});

export async function createAllocation(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const parsed = createSchema.safeParse({
    memberUserId: formData.get("memberUserId"),
    title: formData.get("title"),
    date: formData.get("date"),
    endDate: formData.get("endDate") || undefined,
    startHalf: formData.get("startHalf") || "am",
    endHalf: formData.get("endHalf") || "end",
  });
  if (!parsed.success) return;
  const startMinute = parsed.data.startHalf === "pm" ? 720 : 0;
  const endMinute = parsed.data.endHalf === "midday" ? 720 : 1440;
  const start = parsed.data.date;
  const end = parsed.data.endDate || parsed.data.date;
  if (end === start && endMinute - startMinute < 720) return;

  const [allocation] = await db
    .insert(allocations)
    .values({
      memberUserId: parsed.data.memberUserId,
      title: parsed.data.title,
      date: new Date(`${start}T12:00:00`),
      endDate: new Date(`${end}T12:00:00`),
      startMinute,
      endMinute,
      createdByUserId: actor.id,
    })
    .returning({ id: allocations.id });
  await auditLog({ actorUserId: actor.id, action: "allocation.created", entityType: "allocation", entityId: allocation.id, metadata: { date: parsed.data.date } });
  revalidatePath("/agency/calendar");
}

export async function deleteAllocation(allocationId: string): Promise<void> {
  const actor = await requireAgencyUser();
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
  const actor = await requireAgencyUser();
  if (update.date && update.endDate && update.date === update.endDate && update.startMinute != null && update.endMinute != null && update.endMinute <= update.startMinute) return;
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
