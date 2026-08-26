"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { projectMilestones, projects } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const schema = z.object({ clientAccountId: z.string().min(1), name: z.string().trim().min(2), projectType: z.enum(["brochure_site", "charity_site", "ecommerce", "campaign"]) });
const templates: Record<string, string[]> = {
  brochure_site: ["Discovery", "Design approval", "Build", "Content", "Launch"],
  charity_site: ["Discovery", "Homepage and key pages", "Fundraising templates", "Content migration", "Launch"],
  ecommerce: ["Discovery", "UX and design approval", "Catalogue and checkout", "Content and products", "Launch"],
  campaign: ["Brief", "Creative approval", "Build", "Review", "Launch"],
};

export async function createProject(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const parsed = schema.safeParse({ clientAccountId: formData.get("clientAccountId"), name: formData.get("name"), projectType: formData.get("projectType") || "brochure_site" });
  if (!parsed.success) return;
  const client = await db.query.clientAccounts.findFirst({ where: (account, { eq }) => eq(account.id, parsed.data.clientAccountId) });
  if (!client) return;
  const [project] = await db.insert(projects).values(parsed.data).returning({ id: projects.id });
  await db.insert(projectMilestones).values(templates[parsed.data.projectType].map((title, sortOrder) => ({ projectId: project.id, title, sortOrder })));
  await auditLog({ actorUserId: actor.id, action: "project.created", entityType: "project", entityId: project.id, clientAccountId: client.id, metadata: { projectType: parsed.data.projectType } });
  revalidatePath("/agency/projects");
  revalidatePath("/portal/projects");
}
