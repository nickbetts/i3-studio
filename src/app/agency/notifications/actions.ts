"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { markAllNotificationsReadForUser } from "@/lib/notifications";

export async function markAllRead(): Promise<void> {
  const actor = await requireAgencyUser();
  await markAllNotificationsReadForUser(actor.id);
  revalidatePath("/agency/notifications");
}
