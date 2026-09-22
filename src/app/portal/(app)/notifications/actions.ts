"use server";

import { revalidatePath } from "next/cache";
import { requireClientUser } from "@/lib/auth-helpers";
import { markAllNotificationsReadForUser } from "@/lib/notifications";

export async function markAllRead(): Promise<void> {
  const actor = await requireClientUser();
  await markAllNotificationsReadForUser(actor.id);
  revalidatePath("/portal/notifications");
}
