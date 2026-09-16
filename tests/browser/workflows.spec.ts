import { test, expect, type Page } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { del } from "@vercel/blob";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../src/db";
import { organizations, users, clientAccounts, contentTemplates, contentItems, contentVersions, auditLogs, projects, designAssets, annotations, annotationComments, referenceFiles } from "../../src/db/schema";

const run = randomUUID();
const organizationId = randomUUID();
const clientId = randomUUID();
const otherClientId = randomUUID();
const templateId = randomUUID();
const itemId = randomUUID();
const projectId = randomUUID();
const designId = randomUUID();
const annotationId = randomUUID();
const uploadTitle = `E2E private upload ${run}`;
const password = randomBytes(24).toString("base64url");
const actors = Object.fromEntries(["admin", "account_manager", "content_writer", "client", "other"].map((role) => [role, { id: randomUUID(), email: `e2e-${role}-${run}@example.invalid` }]));

async function login(page: Page, role: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(actors[role].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(agency|portal)$/);
}

test.beforeAll(async () => {
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(organizations).values({ id: organizationId, name: "E2E isolated", slug: `e2e-${run}` });
  await db.insert(clientAccounts).values([clientId, otherClientId].map((id) => ({ id, organizationId, name: `E2E ${id}`, slug: `e2e-${id}`, status: "active" as const, onboardingCompletedAt: new Date(), visibleTabs: ["dashboard", "projects", "files", "approvals", "designs", "content", "support"] })));
  for (const [role, actor] of Object.entries(actors)) {
    await db.insert(users).values({ ...actor, name: `E2E ${role}`, role: (role === "other" ? "client" : role) as typeof users.$inferInsert.role, passwordHash, status: "active", clientAccountId: role === "client" ? clientId : role === "other" ? otherClientId : null });
  }
  await db.insert(contentTemplates).values({ id: templateId, name: `E2E template ${run}`, fields: [{ key: "body", label: "Body", type: "richtext", required: true }], createdByUserId: actors.admin.id });
  await db.insert(contentItems).values({ id: itemId, clientAccountId: clientId, templateId, title: `E2E article ${run}`, assignedToUserId: actors.content_writer.id, createdByUserId: actors.content_writer.id, data: { body: "<h2>Test article</h2><p>Content for a verified approval workflow.</p>" } });
  await db.insert(projects).values({ id: projectId, clientAccountId: clientId, name: "E2E project" });
  await db.insert(designAssets).values({ id: designId, clientAccountId: clientId, createdByUserId: actors.admin.id, title: `E2E design ${run}`, imageUrl: "https://picsum.photos/seed/e2e/800/500" });
  await db.insert(annotations).values({ id: annotationId, designAssetId: designId, x: 0.3, y: 0.5, createdByUserId: actors.client.id });
  await db.insert(annotationComments).values({ annotationId, authorUserId: actors.client.id, body: "E2E client feedback" });
});

test.afterAll(async () => {
  const uploads = await db.query.referenceFiles.findMany({ where: eq(referenceFiles.title, uploadTitle) });
  if (process.env.BLOB_PRIVATE_READ_WRITE_TOKEN) for (const upload of uploads) await del(upload.fileUrl, { token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN });
  await db.delete(referenceFiles).where(inArray(referenceFiles.id, uploads.map((upload) => upload.id)));
  await db.delete(auditLogs).where(inArray(auditLogs.clientAccountId, [clientId, otherClientId]));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, Object.values(actors).map((actor) => actor.id)));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  await db.delete(contentTemplates).where(eq(contentTemplates.id, templateId));
  await db.delete(users).where(inArray(users.id, Object.values(actors).map((actor) => actor.id)));
});

test("client uploads a private reference file larger than 1MB and sees it", async ({ page }) => {
  await login(page, "client");
  await page.goto("/portal/files");
  await page.getByLabel("Title", { exact: true }).fill(uploadTitle);
  await page.locator('input[type="file"]').setInputFiles({ name: "reference.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(1_100_000, 7) });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByText(uploadTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  const row = await db.query.referenceFiles.findFirst({ where: eq(referenceFiles.title, uploadTitle) });
  expect(row?.fileUrl).toMatch(/\.private\.blob\.vercel-storage\.com/);
});

test("writer submits, a separate AM approves, and client signs off with persisted audit", async ({ page }) => {
  await login(page, "content_writer");
  await page.goto(`/agency/content/${itemId}`);
  await expect(page.locator(".tiptap")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await expect.poll(async () => (await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) }))?.status).toBe("pending_am");
  await login(page, "account_manager");
  await page.goto(`/agency/content/${itemId}`);
  await page.getByRole("button", { name: "Approve & send to client", exact: true }).click();
  await expect.poll(async () => (await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) }))?.status).toBe("pending_client");
  await login(page, "client");
  await page.goto(`/portal/content/${itemId}`);
  await expect(page.getByText("Content for a verified approval workflow.")).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(async () => (await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) }))?.status).toBe("approved");
  const versions = await db.query.contentVersions.findMany({ where: eq(contentVersions.contentItemId, itemId) });
  expect(versions).toHaveLength(1);
  const events = await db.query.auditLogs.findMany({ where: eq(auditLogs.entityId, itemId) });
  expect(events.map((event) => event.action)).toEqual(expect.arrayContaining(["content.submitted", "content.am_approved", "content.client_approved"]));
});

test("tenant isolation and forged preview cookies cannot expose another client", async ({ page }) => {
  await login(page, "other");
  await page.context().addCookies([{ name: "i3_preview_user", value: actors.admin.id, domain: "localhost", path: "/" }]);
  await page.goto(`/portal/content/${itemId}`);
  await expect(page.getByText(`E2E article ${run}`, { exact: true })).toHaveCount(0);
  await page.goto(`/portal/projects/${projectId}`);
  await expect(page.getByText("E2E project", { exact: true })).toHaveCount(0);
  await page.goto("/agency/settings");
  await expect(page).toHaveURL(/\/portal$/);
});

test("disabled users lose access without waiting for JWT expiry", async ({ page }) => {
  await login(page, "other");
  await db.update(users).set({ status: "disabled" }).where(eq(users.id, actors.other.id));
  try {
    await page.goto("/portal/support");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await db.update(users).set({ status: "active" }).where(eq(users.id, actors.other.id));
  }
});

test("design author names render without serializing password hashes", async ({ page }) => {
  await login(page, "client");
  await page.goto("/portal/approvals");
  await page.getByRole("tab", { name: /Designs/ }).click();
  await page.getByRole("button", { name: new RegExp(`E2E design ${run}`) }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("E2E client feedback")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("E2E client", { exact: true })).toBeVisible();
  expect(await page.content()).not.toMatch(/passwordHash|\$2[aby]\$10\$/);
});

test("mobile client portal has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "client");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "test-results/portal-mobile.png", fullPage: true });
});