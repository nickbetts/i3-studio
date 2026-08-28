import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { addDays, startOfWeek, subDays, subHours } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  accountManagerAssignments,
  allocations,
  annotationComments,
  annotations,
  approvals,
  auditLogs,
  clientAccounts,
  contentComments,
  contentEvents,
  contentItems,
  contentTemplates,
  contentVersions,
  designAssets,
  designVersions,
  documents,
  onboardingSubmissions,
  organizations,
  projectMilestones,
  projects,
  referenceFiles,
  tasks,
  ticketMessages,
  tickets,
  users,
} from "./schema";
import { DEFAULT_TEMPLATE_FIELDS } from "../lib/content";

config({ path: ".env.local" });

// This script is fully re-runnable: it upserts users/org/clients, then wipes and
// rebuilds each demo client account's dependent data (projects, files, designs,
// tickets, content, calendar, audit trail) so `pnpm db:seed` always reflects the
// current schema/features. It never touches data outside these two demo clients.

type Role = "admin" | "account_manager" | "content_writer" | "client";

async function upsertUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
  clientAccountId?: string | null;
  title?: string;
  clientRole?: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    await db
      .update(users)
      .set({
        name: input.name,
        passwordHash,
        role: input.role,
        status: "active",
        clientAccountId: input.clientAccountId ?? null,
        title: input.title,
        clientRole: input.clientRole,
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
      status: "active",
      clientAccountId: input.clientAccountId ?? null,
      title: input.title,
      clientRole: input.clientRole,
    })
    .returning({ id: users.id });
  return row.id;
}

async function upsertTemplate(name: string, contentType: string, createdByUserId: string) {
  const existing = await db.query.contentTemplates.findFirst({ where: eq(contentTemplates.name, name) });
  if (existing) {
    await db.update(contentTemplates).set({ fields: DEFAULT_TEMPLATE_FIELDS[contentType] ?? DEFAULT_TEMPLATE_FIELDS.blog, archived: false }).where(eq(contentTemplates.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(contentTemplates)
    .values({ name, contentType, fields: DEFAULT_TEMPLATE_FIELDS[contentType] ?? DEFAULT_TEMPLATE_FIELDS.blog, createdByUserId })
    .returning({ id: contentTemplates.id });
  return row.id;
}

// Wipes everything scoped to a demo client account so it can be rebuilt from scratch.
// Cascades (schema onDelete: "cascade") take care of child rows: milestones, approvals,
// annotations/annotationComments/designVersions, ticketMessages, content versions/comments/events.
async function wipeClientDemoData(clientAccountId: string) {
  await db.delete(contentItems).where(eq(contentItems.clientAccountId, clientAccountId));
  await db.delete(designAssets).where(eq(designAssets.clientAccountId, clientAccountId));
  await db.delete(documents).where(eq(documents.clientAccountId, clientAccountId));
  await db.delete(tickets).where(eq(tickets.clientAccountId, clientAccountId));
  await db.delete(referenceFiles).where(eq(referenceFiles.clientAccountId, clientAccountId));
  await db.delete(projects).where(eq(projects.clientAccountId, clientAccountId));
  await db.delete(tasks).where(eq(tasks.clientAccountId, clientAccountId));
  await db.delete(allocations).where(eq(allocations.clientAccountId, clientAccountId));
  await db.delete(auditLogs).where(eq(auditLogs.clientAccountId, clientAccountId));
  await db.delete(onboardingSubmissions).where(eq(onboardingSubmissions.clientAccountId, clientAccountId));
}

// Deterministic picsum images so the same demo data looks the same across seed runs.
const img = (seed: string) => `https://picsum.photos/seed/${seed}/1200/675`;

async function main() {
  const [org] = await db
    .insert(organizations)
    .values({ name: "i3 Studio", slug: "i3-studio" })
    .onConflictDoNothing({ target: organizations.slug })
    .returning({ id: organizations.id });

  const orgId =
    org?.id ?? (await db.query.organizations.findFirst({ where: eq(organizations.slug, "i3-studio") }))!.id;

  // --- Internal team ---------------------------------------------------
  const adminId = await upsertUser({
    email: "admin@i3studio.com",
    name: "i3 Admin",
    password: "password123",
    role: "admin",
    title: "Studio Director",
  });

  await upsertUser({
    email: "admin@i3media.net",
    name: "i3 Media Admin",
    password: "i3gangang",
    role: "admin",
    title: "Studio Administrator",
  });

  const managerId = await upsertUser({
    email: "manager@i3studio.com",
    name: "Alex Manager",
    password: "password123",
    role: "account_manager",
    title: "Account Manager",
  });

  const writerId = await upsertUser({
    email: "writer@i3studio.com",
    name: "Jordan Writer",
    password: "password123",
    role: "content_writer",
    title: "Content Writer",
  });

  // --- Client 1: Acme Co — fresh signup, still in onboarding ------------
  const existingAcme = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.slug, "acme") });
  const acmeId =
    existingAcme?.id ??
    (
      await db
        .insert(clientAccounts)
        .values({ organizationId: orgId, name: "Acme Co", slug: "acme", status: "onboarding" })
        .returning({ id: clientAccounts.id })
    )[0].id;

  await upsertUser({
    email: "client@acme.com",
    name: "Casey Client",
    password: "password123",
    role: "client",
    clientAccountId: acmeId,
    title: "Marketing Lead",
    clientRole: "Primary contact",
  });

  await db.insert(accountManagerAssignments).values({ clientAccountId: acmeId, userId: managerId }).onConflictDoNothing();
  await db.insert(accountManagerAssignments).values({ clientAccountId: acmeId, userId: adminId }).onConflictDoNothing();

  // --- Client 2: Brightleaf Charity — fully onboarded, rich demo data ---
  const existingBrightleaf = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.slug, "brightleaf") });
  const brightleafId =
    existingBrightleaf?.id ??
    (
      await db
        .insert(clientAccounts)
        .values({ organizationId: orgId, name: "Brightleaf Charity", slug: "brightleaf", status: "active" })
        .returning({ id: clientAccounts.id })
    )[0].id;
  await db.update(clientAccounts).set({ status: "active", onboardingCompletedAt: subDays(new Date(), 30) }).where(eq(clientAccounts.id, brightleafId));

  const clientUserId = await upsertUser({
    email: "client@brightleaf.org",
    name: "Nina Rivers",
    password: "password123",
    role: "client",
    clientAccountId: brightleafId,
    title: "Head of Marketing",
    clientRole: "Primary approver",
  });

  await db.insert(accountManagerAssignments).values({ clientAccountId: brightleafId, userId: managerId }).onConflictDoNothing();
  await db.insert(accountManagerAssignments).values({ clientAccountId: brightleafId, userId: adminId }).onConflictDoNothing();

  // Wipe and rebuild each demo client's dependent data so re-running this script
  // always matches the current app features.
  await wipeClientDemoData(acmeId);
  await wipeClientDemoData(brightleafId);

  await db.insert(onboardingSubmissions).values({
    clientAccountId: brightleafId,
    currentStep: 6,
    completedAt: subDays(new Date(), 30),
    data: {
      legalName: "Brightleaf Charity Trust",
      tradingName: "Brightleaf",
      website: "https://brightleaf.org",
      industry: "Charity & non-profit",
      companySize: "11-50",
      primaryContactName: "Nina Rivers",
      primaryContactEmail: "client@brightleaf.org",
      objectives: "Grow monthly donations and refresh our brand ahead of our 10th anniversary.",
      targetAudience: "UK donors aged 35-65, existing volunteers, corporate partners.",
      commsPreference: "Email + portal",
      acceptedTerms: true,
    },
  });

  // Content templates are shared across clients, so upsert rather than wipe.
  const blogTemplate = { id: await upsertTemplate("Blog post", "blog", adminId) };
  const webTemplate = { id: await upsertTemplate("Web page copy", "webpage", adminId) };

  // ==========================================================================
  // Acme Co — deliberately minimal: a brand-new client mid-onboarding.
  // ==========================================================================
  const [acmeProject] = await db
    .insert(projects)
    .values({ clientAccountId: acmeId, name: "Acme Brochure Site", projectType: "brochure_site", status: "active" })
    .returning({ id: projects.id });
  await db.insert(projectMilestones).values(
    ["Discovery", "Design approval", "Build", "Content", "Launch"].map((title, sortOrder) => ({
      projectId: acmeProject.id,
      title,
      sortOrder,
      status: "open" as const,
    })),
  );
  await db.insert(tasks).values({ clientAccountId: acmeId, title: "Send brand assets", status: "open", priority: "medium" as const, createdByUserId: managerId });

  // ==========================================================================
  // Brightleaf Charity — rich demo data covering every workflow/status.
  // ==========================================================================

  // --- Projects + milestones -----------------------------------------------
  const [brightleafProject] = await db
    .insert(projects)
    .values({ clientAccountId: brightleafId, name: "Brightleaf Charity Site", projectType: "charity_site", status: "active" })
    .returning({ id: projects.id });
  const brightleafMilestones = ["Discovery", "Homepage and key pages", "Fundraising templates", "Content migration", "Launch"];
  await db.insert(projectMilestones).values(
    brightleafMilestones.map((title, sortOrder) => ({
      projectId: brightleafProject.id,
      title,
      sortOrder,
      status: (sortOrder < 2 ? "done" : sortOrder === 2 ? "in_progress" : "open") as "done" | "in_progress" | "open",
    })),
  );

  // --- Tasks -----------------------------------------------------------------
  await db.insert(tasks).values([
    { clientAccountId: brightleafId, title: "Approve homepage copy", status: "open", priority: "high" as const, assignedToUserId: clientUserId, createdByUserId: managerId },
    { clientAccountId: brightleafId, title: "Confirm donation platform provider", status: "open", priority: "urgent" as const, createdByUserId: managerId },
    { clientAccountId: brightleafId, title: "Share logo pack", status: "done", priority: "low" as const, createdByUserId: managerId },
  ]);

  // --- Documents + approvals ---------------------------------------------------
  const [approvedDoc] = await db
    .insert(documents)
    .values({
      clientAccountId: brightleafId,
      uploadedByUserId: managerId,
      title: "Brand guidelines v2",
      description: "Updated logo usage and colour palette.",
      kind: "document",
      fileUrl: "https://picsum.photos/seed/brand-guidelines/1600/1200",
      fileName: "brand-guidelines-v2.pdf",
      contentType: "application/pdf",
      size: 2_400_000,
      status: "approved",
      createdAt: subDays(new Date(), 12),
    })
    .returning({ id: documents.id });
  await db.insert(approvals).values({ documentId: approvedDoc.id, clientAccountId: brightleafId, decidedByUserId: clientUserId, decision: "approved", note: "Looks great, thank you!", createdAt: subDays(new Date(), 11) });

  await db.insert(documents).values({
    clientAccountId: brightleafId,
    uploadedByUserId: managerId,
    title: "Homepage copy draft",
    description: "First pass at the new homepage copy — awaiting your review.",
    kind: "document",
    fileUrl: "https://picsum.photos/seed/homepage-copy/1600/1200",
    fileName: "homepage-copy-draft.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 84_000,
    status: "pending",
    createdAt: subDays(new Date(), 2),
  });

  const [changesDoc] = await db
    .insert(documents)
    .values({
      clientAccountId: brightleafId,
      uploadedByUserId: managerId,
      title: "Print ad artwork",
      description: "Quarter-page ad for the local paper.",
      kind: "document",
      fileUrl: "https://picsum.photos/seed/print-ad/1600/1200",
      fileName: "print-ad-artwork.pdf",
      contentType: "application/pdf",
      size: 5_100_000,
      status: "changes_requested",
      createdAt: subDays(new Date(), 6),
    })
    .returning({ id: documents.id });
  await db.insert(approvals).values({ documentId: changesDoc.id, clientAccountId: brightleafId, decidedByUserId: clientUserId, decision: "changes_requested", note: "Can we swap the photo in the top-right? It's a bit dark.", createdAt: subDays(new Date(), 5) });

  // --- Reference files -----------------------------------------------------------
  await db.insert(referenceFiles).values([
    { clientAccountId: brightleafId, uploadedByUserId: clientUserId, title: "Existing logo pack", fileUrl: "https://picsum.photos/seed/logo-pack/1200/900", fileName: "logo-pack.zip", contentType: "application/zip", size: 12_500_000, createdAt: subDays(new Date(), 20) },
    { clientAccountId: brightleafId, uploadedByUserId: managerId, title: "Competitor examples", fileUrl: "https://picsum.photos/seed/competitors/1200/900", fileName: "competitor-examples.pdf", contentType: "application/pdf", size: 3_200_000, createdAt: subDays(new Date(), 18) },
  ]);

  // --- Design assets, versions and annotations ------------------------------------
  // Design 1: approved, with a resolved pin thread AND two versions (demonstrates version history).
  const [approvedDesign] = await db
    .insert(designAssets)
    .values({ clientAccountId: brightleafId, createdByUserId: managerId, title: "Homepage hero concept", imageUrl: img("hero-concept-v2"), status: "approved", createdAt: subDays(new Date(), 14) })
    .returning({ id: designAssets.id });
  await db.insert(designVersions).values([
    { designAssetId: approvedDesign.id, version: 1, imageUrl: img("hero-concept-v1"), status: "changes_requested", createdAt: subDays(new Date(), 14) },
    { designAssetId: approvedDesign.id, version: 2, imageUrl: img("hero-concept-v2"), status: "approved", approvedByUserId: clientUserId, approvedAt: subDays(new Date(), 12), createdAt: subDays(new Date(), 12) },
  ]);
  const [resolvedAnnotation] = await db
    .insert(annotations)
    .values({ designAssetId: approvedDesign.id, x: 0.42, y: 0.3, createdByUserId: clientUserId, resolved: true, createdAt: subDays(new Date(), 13) })
    .returning({ id: annotations.id });
  await db.insert(annotationComments).values([
    { annotationId: resolvedAnnotation.id, authorUserId: clientUserId, body: "Can the headline be a bit bigger?", createdAt: subDays(new Date(), 13) },
    { annotationId: resolvedAnnotation.id, authorUserId: managerId, body: "Bumped it up two sizes — take a look now.", createdAt: subDays(new Date(), 12) },
  ]);

  // Design 2: pending, two open pin threads (no version history yet — single-version asset).
  const [pendingDesign] = await db
    .insert(designAssets)
    .values({ clientAccountId: brightleafId, createdByUserId: managerId, title: "Donate page redesign", imageUrl: img("donate-page"), status: "pending", createdAt: subDays(new Date(), 3) })
    .returning({ id: designAssets.id });
  const [openAnnotation1] = await db
    .insert(annotations)
    .values({ designAssetId: pendingDesign.id, x: 0.5, y: 0.65, createdByUserId: clientUserId, resolved: false, createdAt: subDays(new Date(), 2) })
    .returning({ id: annotations.id });
  await db.insert(annotationComments).values({ annotationId: openAnnotation1.id, authorUserId: clientUserId, body: "Could the donate button use our brand orange instead of blue?", createdAt: subDays(new Date(), 2) });
  const [openAnnotation2] = await db
    .insert(annotations)
    .values({ designAssetId: pendingDesign.id, x: 0.2, y: 0.15, createdByUserId: clientUserId, resolved: false, createdAt: subDays(new Date(), 1) })
    .returning({ id: annotations.id });
  await db.insert(annotationComments).values({ annotationId: openAnnotation2.id, authorUserId: clientUserId, body: "Logo looks slightly stretched here.", createdAt: subDays(new Date(), 1) });

  // Design 3: changes requested, with the feedback pin that explains why.
  const [changesDesign] = await db
    .insert(designAssets)
    .values({ clientAccountId: brightleafId, createdByUserId: managerId, title: "Email newsletter template", imageUrl: img("newsletter"), status: "changes_requested", createdAt: subDays(new Date(), 7) })
    .returning({ id: designAssets.id });
  const [newsletterAnnotation] = await db
    .insert(annotations)
    .values({ designAssetId: changesDesign.id, x: 0.5, y: 0.45, createdByUserId: clientUserId, resolved: false, createdAt: subDays(new Date(), 6) })
    .returning({ id: annotations.id });
  await db.insert(annotationComments).values({ annotationId: newsletterAnnotation.id, authorUserId: clientUserId, body: "This template feels a bit cluttered — can we simplify the layout?", createdAt: subDays(new Date(), 6) });

  // --- Support tickets: one of every status and priority --------------------------
  const [openTicket] = await db
    .insert(tickets)
    .values({ clientAccountId: brightleafId, subject: "Website images not loading on mobile", status: "open", priority: "high" as const, createdByUserId: clientUserId, assignedToUserId: managerId, createdAt: subDays(new Date(), 1) })
    .returning({ id: tickets.id });
  await db.insert(ticketMessages).values([
    { ticketId: openTicket.id, authorUserId: clientUserId, body: "A few of our supporters have said the homepage images don't load on their phones — can you take a look?", channel: "portal", direction: "inbound", createdAt: subDays(new Date(), 1) },
    { ticketId: openTicket.id, authorUserId: managerId, body: "Thanks for flagging — we're looking into it now and will update you today.", channel: "portal", direction: "outbound", createdAt: subHours(new Date(), 20) },
  ]);

  const [urgentTicket] = await db
    .insert(tickets)
    .values({ clientAccountId: brightleafId, subject: "Donation form is returning an error at checkout", status: "open", priority: "urgent" as const, createdByUserId: clientUserId, assignedToUserId: adminId, createdAt: subHours(new Date(), 3) })
    .returning({ id: tickets.id });
  await db.insert(ticketMessages).values({ ticketId: urgentTicket.id, authorUserId: clientUserId, body: "Several donors have reported the payment form throwing an error right at the last step — we're losing donations, please treat as urgent!", channel: "portal", direction: "inbound", createdAt: subHours(new Date(), 3) });

  const [pendingTicket] = await db
    .insert(tickets)
    .values({ clientAccountId: brightleafId, subject: "Can we add a newsletter signup?", status: "pending", priority: "medium" as const, createdByUserId: clientUserId, createdAt: subHours(new Date(), 5) })
    .returning({ id: tickets.id });
  await db.insert(ticketMessages).values({ ticketId: pendingTicket.id, authorUserId: clientUserId, body: "Would it be possible to add a newsletter signup box to the footer?", channel: "portal", direction: "inbound", createdAt: subHours(new Date(), 5) });

  const [resolvedTicket] = await db
    .insert(tickets)
    .values({ clientAccountId: brightleafId, subject: "Domain renewal question", status: "resolved", priority: "low" as const, createdByUserId: clientUserId, assignedToUserId: adminId, createdAt: subDays(new Date(), 9) })
    .returning({ id: tickets.id });
  await db.insert(ticketMessages).values([
    { ticketId: resolvedTicket.id, authorUserId: clientUserId, body: "When is our domain due for renewal this year?", channel: "email", direction: "inbound", mailgunMessageId: "demo-msg-1", createdAt: subDays(new Date(), 9) },
    { ticketId: resolvedTicket.id, authorUserId: adminId, body: "It renews on the 14th of next month — we handle it automatically, no action needed from you.", channel: "email", direction: "outbound", mailgunMessageId: "demo-msg-2", createdAt: subDays(new Date(), 8) },
  ]);

  const [closedTicket] = await db
    .insert(tickets)
    .values({ clientAccountId: brightleafId, subject: "Old ticket — can this be archived?", status: "closed", priority: "low" as const, createdByUserId: clientUserId, assignedToUserId: managerId, createdAt: subDays(new Date(), 40) })
    .returning({ id: tickets.id });
  await db.insert(ticketMessages).values([
    { ticketId: closedTicket.id, authorUserId: clientUserId, body: "This was resolved ages ago, just tidying up our list.", channel: "portal", direction: "inbound", createdAt: subDays(new Date(), 40) },
    { ticketId: closedTicket.id, authorUserId: managerId, body: "All good — closing this one out.", channel: "portal", direction: "outbound", createdAt: subDays(new Date(), 39) },
  ]);

  // --- Content: one item per workflow status ---------------------------------------
  const blogBody = (topic: string) =>
    `<h2>${topic}</h2><p>Every year, our community comes together to make a real difference. Here's what you need to know.</p><ul><li>Why it matters</li><li>How you can help</li><li>What's next</li></ul><blockquote>Together, we've raised more than we ever thought possible.</blockquote>`;

  async function createContentItem(input: {
    title: string;
    templateId: string;
    contentType: string;
    status: "draft" | "pending_am" | "am_changes" | "pending_client" | "client_changes" | "approved" | "published";
    data: Record<string, unknown>;
    events: { type: string; actorUserId: string; actorRole: Role; fromStatus: string | null; toStatus: string | null; note?: string; daysAgo: number }[];
    versions?: { version: number; authorUserId: string; note: string; daysAgo: number }[];
    comments?: { fieldKey: string | null; quote?: string; body: string; authorUserId: string; resolved: boolean; daysAgo: number }[];
  }) {
    const [item] = await db
      .insert(contentItems)
      .values({
        clientAccountId: brightleafId,
        templateId: input.templateId,
        title: input.title,
        contentType: input.contentType,
        status: input.status,
        assignedToUserId: writerId,
        createdByUserId: writerId,
        currentVersion: input.versions?.length ?? 0,
        data: input.data,
        createdAt: subDays(new Date(), input.events[0]?.daysAgo ?? 1),
        updatedAt: subDays(new Date(), input.events.at(-1)?.daysAgo ?? 0),
      })
      .returning({ id: contentItems.id });

    for (const event of input.events) {
      await db.insert(contentEvents).values({
        contentItemId: item.id,
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note ?? null,
        createdAt: subDays(new Date(), event.daysAgo),
      });
    }
    for (const version of input.versions ?? []) {
      await db.insert(contentVersions).values({
        contentItemId: item.id,
        version: version.version,
        data: input.data,
        authorUserId: version.authorUserId,
        note: version.note,
        createdAt: subDays(new Date(), version.daysAgo),
      });
    }
    for (const comment of input.comments ?? []) {
      await db.insert(contentComments).values({
        contentItemId: item.id,
        fieldKey: comment.fieldKey,
        quote: comment.quote ?? null,
        body: comment.body,
        authorUserId: comment.authorUserId,
        resolved: comment.resolved,
        createdAt: subDays(new Date(), comment.daysAgo),
      });
    }
    return item.id;
  }

  // 1. Draft — writer still working on it.
  await createContentItem({
    title: "5 Tips for Year-End Giving",
    templateId: blogTemplate.id,
    contentType: "blog",
    status: "draft",
    data: { pageName: "5-tips-year-end-giving", title: "5 Tips for Year-End Giving", metaTitle: "5 Tips for Year-End Giving | Brightleaf", metaDescription: "Practical ways to make your year-end donation go further.", body: blogBody("5 Tips for Year-End Giving"), faqs: [{ question: "Is my donation tax deductible?", answer: "Yes, Brightleaf is a registered charity." }] },
    events: [{ type: "created", actorUserId: writerId, actorRole: "content_writer", fromStatus: null, toStatus: "draft", daysAgo: 1 }],
  });

  // 2. Pending AM review.
  await createContentItem({
    title: "Volunteer Spotlight: March",
    templateId: blogTemplate.id,
    contentType: "blog",
    status: "pending_am",
    data: { pageName: "volunteer-spotlight-march", title: "Volunteer Spotlight: March", metaTitle: "Volunteer Spotlight: March | Brightleaf", metaDescription: "Meet the volunteers making a difference this month.", body: blogBody("Volunteer Spotlight: March"), faqs: [] },
    events: [
      { type: "created", actorUserId: writerId, actorRole: "content_writer", fromStatus: null, toStatus: "draft", daysAgo: 4 },
      { type: "submitted", actorUserId: writerId, actorRole: "content_writer", fromStatus: "draft", toStatus: "pending_am", daysAgo: 2 },
    ],
    versions: [{ version: 1, authorUserId: writerId, note: "Submitted for review", daysAgo: 2 }],
  });

  // 3. AM requested changes.
  await createContentItem({
    title: "New Fundraising Page Copy",
    templateId: webTemplate.id,
    contentType: "webpage",
    status: "am_changes",
    data: { pageName: "fundraising", url: "/fundraising", title: "Help Us Reach Our Goal", metaTitle: "Fundraising | Brightleaf", metaDescription: "See how your donation helps our community programmes.", body: "<h2>Help Us Reach Our Goal</h2><p>Every donation brings us closer to our 2026 target.</p>" },
    events: [
      { type: "created", actorUserId: writerId, actorRole: "content_writer", fromStatus: null, toStatus: "draft", daysAgo: 6 },
      { type: "submitted", actorUserId: writerId, actorRole: "content_writer", fromStatus: "draft", toStatus: "pending_am", daysAgo: 5 },
      { type: "am_changes", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "am_changes", note: "Good start — can you add a stat about last year's impact, and tighten the meta description?", daysAgo: 4 },
    ],
    versions: [{ version: 1, authorUserId: writerId, note: "Submitted for review", daysAgo: 5 }],
    comments: [
      { fieldKey: "body", quote: "Every donation brings us closer to our 2026 target.", body: "Let's open with a concrete number — e.g. how many meals/families helped last year.", authorUserId: managerId, resolved: false, daysAgo: 4 },
    ],
  });

  // 4. Pending client approval.
  await createContentItem({
    title: "Annual Report Highlights",
    templateId: blogTemplate.id,
    contentType: "blog",
    status: "pending_client",
    data: { pageName: "annual-report-highlights", title: "Annual Report Highlights", metaTitle: "Annual Report Highlights | Brightleaf", metaDescription: "Our biggest wins from the past year, in numbers.", body: blogBody("Annual Report Highlights"), faqs: [{ question: "Where can I read the full report?", answer: "The full PDF is linked at the bottom of this page." }] },
    events: [
      { type: "created", actorUserId: writerId, actorRole: "content_writer", fromStatus: null, toStatus: "draft", daysAgo: 8 },
      { type: "submitted", actorUserId: writerId, actorRole: "content_writer", fromStatus: "draft", toStatus: "pending_am", daysAgo: 6 },
      { type: "am_approved", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", note: "Reads well, sending to Nina.", daysAgo: 5 },
      { type: "sent_to_client", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", daysAgo: 5 },
    ],
    versions: [{ version: 1, authorUserId: writerId, note: "Submitted for review", daysAgo: 6 }],
  });

  // 5. Client requested changes — includes text-highlight quote comments.
  await createContentItem({
    title: "Corporate Partnerships Page",
    templateId: webTemplate.id,
    contentType: "webpage",
    status: "client_changes",
    data: { pageName: "corporate-partnerships", url: "/partnerships", title: "Partner With Brightleaf", metaTitle: "Corporate Partnerships | Brightleaf", metaDescription: "Explore how your business can support our mission.", body: "<h2>Partner With Brightleaf</h2><p>Join the businesses already supporting our work across the region.</p><p>Contact our partnerships team to get started.</p>" },
    events: [
      { type: "created", actorUserId: writerId, actorRole: "content_writer", fromStatus: null, toStatus: "draft", daysAgo: 10 },
      { type: "submitted", actorUserId: writerId, actorRole: "content_writer", fromStatus: "draft", toStatus: "pending_am", daysAgo: 8 },
      { type: "am_approved", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", daysAgo: 7 },
      { type: "sent_to_client", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", daysAgo: 7 },
      { type: "client_changes", actorUserId: clientUserId, actorRole: "client", fromStatus: "pending_client", toStatus: "client_changes", note: "Can we name a couple of our current partners for credibility?", daysAgo: 3 },
    ],
    versions: [{ version: 1, authorUserId: writerId, note: "Submitted for review", daysAgo: 8 }],
    comments: [
      { fieldKey: "body", quote: "Join the businesses already supporting our work", body: "Let's name-drop 2-3 partners here if they're happy to be featured.", authorUserId: clientUserId, resolved: false, daysAgo: 3 },
      { fieldKey: "metaDescription", body: "This looks fine as is.", authorUserId: clientUserId, resolved: true, daysAgo: 3 },
    ],
  });

  // 6. Approved by client.
  await createContentItem({
    title: "Gala 2026 Recap",
    templateId: blogTemplate.id,
    contentType: "blog",
    status: "approved",
    data: { pageName: "gala-2026-recap", title: "Gala 2026 Recap", metaTitle: "Gala 2026 Recap | Brightleaf", metaDescription: "Highlights and thank-yous from this year's fundraising gala.", body: blogBody("Gala 2026 Recap"), faqs: [] },
    events: [
      { type: "created", actorUserId: writerId, actorRole: "content_writer", fromStatus: null, toStatus: "draft", daysAgo: 15 },
      { type: "submitted", actorUserId: writerId, actorRole: "content_writer", fromStatus: "draft", toStatus: "pending_am", daysAgo: 13 },
      { type: "am_approved", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", daysAgo: 12 },
      { type: "sent_to_client", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", daysAgo: 12 },
      { type: "client_approved", actorUserId: clientUserId, actorRole: "client", fromStatus: "pending_client", toStatus: "approved", note: "Perfect, thank you!", daysAgo: 10 },
    ],
    versions: [
      { version: 1, authorUserId: writerId, note: "Submitted for review", daysAgo: 13 },
      { version: 2, authorUserId: clientUserId, note: "Client approved", daysAgo: 10 },
    ],
  });

  // 7. Published — full lifecycle with two content versions.
  await createContentItem({
    title: "About Us Refresh",
    templateId: webTemplate.id,
    contentType: "webpage",
    status: "published",
    data: { pageName: "about-us", url: "/about", title: "About Brightleaf", metaTitle: "About Us | Brightleaf", metaDescription: "Our story, our mission, and the community we serve.", body: "<h2>Our Story</h2><p>Founded 10 years ago, Brightleaf has grown from a single food bank to a network of community programmes.</p><h3>Our Mission</h3><p>To make sure nobody in our community goes without support.</p>" },
    events: [
      { type: "created", actorUserId: writerId, actorRole: "content_writer", fromStatus: null, toStatus: "draft", daysAgo: 25 },
      { type: "submitted", actorUserId: writerId, actorRole: "content_writer", fromStatus: "draft", toStatus: "pending_am", daysAgo: 22 },
      { type: "am_approved", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", daysAgo: 21 },
      { type: "sent_to_client", actorUserId: managerId, actorRole: "account_manager", fromStatus: "pending_am", toStatus: "pending_client", daysAgo: 21 },
      { type: "client_approved", actorUserId: clientUserId, actorRole: "client", fromStatus: "pending_client", toStatus: "approved", daysAgo: 19 },
      { type: "published", actorUserId: managerId, actorRole: "account_manager", fromStatus: "approved", toStatus: "published", daysAgo: 18 },
    ],
    versions: [
      { version: 1, authorUserId: writerId, note: "Submitted for review", daysAgo: 22 },
      { version: 2, authorUserId: clientUserId, note: "Client approved", daysAgo: 19 },
    ],
  });

  // --- Calendar allocations ------------------------------------------------------
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  await db.insert(allocations).values([
    { memberUserId: managerId, clientAccountId: brightleafId, title: "Brightleaf onboarding calls", date: weekStart, endDate: addDays(weekStart, 1), startMinute: 0, endMinute: 1440, createdByUserId: managerId },
    { memberUserId: writerId, clientAccountId: brightleafId, title: "Content batch — Brightleaf blog", date: addDays(weekStart, 2), endDate: addDays(weekStart, 2), startMinute: 0, endMinute: 1440, createdByUserId: managerId },
    { memberUserId: managerId, clientAccountId: acmeId, title: "Acme kickoff prep", date: addDays(weekStart, 4), endDate: addDays(weekStart, 4), startMinute: 0, endMinute: 720, createdByUserId: managerId },
  ]);
  // Internal-only block (not tied to a client) — keyed by title so re-seeding doesn't duplicate it.
  await db.delete(allocations).where(eq(allocations.title, "Internal ops"));
  await db.insert(allocations).values({ memberUserId: adminId, clientAccountId: null, title: "Internal ops", date: addDays(weekStart, 3), endDate: addDays(weekStart, 3), startMinute: 720, endMinute: 1440, createdByUserId: adminId });

  // --- Audit log entries for the dashboard activity feed --------------------------
  await db.insert(auditLogs).values([
    { actorUserId: managerId, action: "document.uploaded", entityType: "document", clientAccountId: brightleafId, createdAt: subDays(new Date(), 12) },
    { actorUserId: clientUserId, action: "document.approved", entityType: "document", clientAccountId: brightleafId, createdAt: subDays(new Date(), 11) },
    { actorUserId: managerId, action: "design.uploaded", entityType: "design_asset", clientAccountId: brightleafId, createdAt: subDays(new Date(), 14) },
    { actorUserId: managerId, action: "design.version_uploaded", entityType: "design_asset", clientAccountId: brightleafId, metadata: { version: 2 }, createdAt: subDays(new Date(), 12) },
    { actorUserId: clientUserId, action: "design.annotation_created", entityType: "annotation", clientAccountId: brightleafId, createdAt: subDays(new Date(), 2) },
    { actorUserId: writerId, action: "content.submitted", entityType: "content_item", clientAccountId: brightleafId, createdAt: subDays(new Date(), 2) },
    { actorUserId: managerId, action: "content.am_changes", entityType: "content_item", clientAccountId: brightleafId, createdAt: subDays(new Date(), 4) },
    { actorUserId: clientUserId, action: "content.client_approved", entityType: "content_item", clientAccountId: brightleafId, createdAt: subDays(new Date(), 10) },
    { actorUserId: clientUserId, action: "content.comment", entityType: "content_item", clientAccountId: brightleafId, createdAt: subDays(new Date(), 3) },
    { actorUserId: clientUserId, action: "reference.uploaded", entityType: "reference_file", clientAccountId: brightleafId, createdAt: subDays(new Date(), 20) },
    { actorUserId: managerId, action: "ticket.replied", entityType: "ticket", clientAccountId: brightleafId, createdAt: subHours(new Date(), 20) },
    { actorUserId: managerId, action: "ticket.status_updated", entityType: "ticket", clientAccountId: brightleafId, metadata: { status: "closed" }, createdAt: subDays(new Date(), 39) },
  ]);

  console.log("Seed complete (rebuilt demo data for Acme + Brightleaf). Logins (password: password123 unless noted):");
  console.log("  admin@i3studio.com       (admin)");
  console.log("  admin@i3media.net       (admin, password: i3gangang)");
  console.log("  manager@i3studio.com     (account manager)");
  console.log("  writer@i3studio.com      (content writer)");
  console.log("  client@acme.com          (client — Acme Co, still in onboarding)");
  console.log("  client@brightleaf.org    (client — Brightleaf Charity, fully onboarded demo data)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
