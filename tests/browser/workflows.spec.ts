import { test, expect, type Page } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { del } from "@vercel/blob";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../src/db";
import { organizations, users, clientAccounts, contentTemplates, contentItems, contentVersions, auditLogs, projects, designAssets, annotations, annotationComments, referenceFiles, projectTemplates, tasks, taskAssignments, clientTimeBudgets, clientServiceAllocations, timeEntries, tickets, ticketMessages } from "../../src/db/schema";
import { monthWindow } from "../../src/lib/time-budget";

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
  await db.delete(projectTemplates).where(eq(projectTemplates.name, `E2E project template ${run}`));
  await db.delete(tasks).where(eq(tasks.title, `E2E task ${run}`));
  const newClient = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.name, `E2E new client ${run}`) });
  if (newClient) await db.delete(clientAccounts).where(eq(clientAccounts.id, newClient.id));
  await db.delete(auditLogs).where(inArray(auditLogs.clientAccountId, [clientId, otherClientId]));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, Object.values(actors).map((actor) => actor.id)));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  await db.delete(contentTemplates).where(eq(contentTemplates.id, templateId));
  await db.delete(users).where(inArray(users.id, Object.values(actors).map((actor) => actor.id)));
});

test("client uploads a private reference file larger than 1MB and sees it", async ({ page }) => {
  await login(page, "client");
  await page.goto("/portal/files");
  await page.locator("summary").filter({ hasText: "Upload a reference file" }).click();
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

test("admin builds a project template with milestones and required deliverables", async ({ page }) => {
  const templateName = `E2E project template ${run}`;
  await login(page, "admin");
  await page.goto("/agency/settings/project-templates");
  await page.locator("summary").filter({ hasText: "New project template" }).click();
  await page.getByLabel("Name", { exact: true }).fill(templateName);
  await page.getByRole("button", { name: "Create template", exact: true }).click();
  const templateCard = page.locator('[data-testid^="project-template-"]', { has: page.getByText(templateName, { exact: true }) }).first();
  await expect(templateCard).toBeVisible();
  await templateCard.getByRole("button", { name: "Add milestone", exact: true }).click();
  await templateCard.locator('input[value="New milestone"]').fill("Discovery call");
  await templateCard.getByRole("button", { name: "Add deliverable", exact: true }).click();
  await templateCard.locator('input[value="New deliverable"]').fill("Homepage design");
  await templateCard.getByRole("button", { name: "Save template", exact: true }).click();
  await expect(page.getByText("Project template saved")).toBeVisible();
  await page.reload();
  const reloadedCard = page.locator('[data-testid^="project-template-"]', { has: page.getByText(templateName, { exact: true }) }).first();
  await expect(reloadedCard.locator('input[value="Discovery call"]')).toBeVisible();
  await expect(reloadedCard.locator('input[value="Homepage design"]')).toBeVisible();
});

test("admin creates a client with a client type, manages AMs, and builds a project from a template", async ({ page }) => {
  const newClientName = `E2E new client ${run}`;
  const newClientEmail = `e2e-new-client-${run}@example.invalid`;
  await login(page, "admin");

  await page.goto("/agency/clients");
  await page.locator("summary").filter({ hasText: "New client" }).click();
  await page.getByLabel("Company name", { exact: true }).fill(newClientName);
  await page.getByLabel("Client email", { exact: true }).fill(newClientEmail);
  await page.getByLabel("Temporary password", { exact: true }).fill(randomBytes(24).toString("base64url"));
  await page.getByLabel("Client type", { exact: true }).click();
  await page.getByRole("option", { name: "Charity", exact: true }).click();
  await page.getByRole("button", { name: "Create client", exact: true }).click();
  await expect(page.getByRole("link", { name: newClientName, exact: true })).toBeVisible();

  await page.getByRole("link", { name: newClientName, exact: true }).click();
  await expect(page).toHaveURL(/\/agency\/clients\/[a-z0-9-]+$/);
  await page.getByLabel("Add account manager", { exact: true }).click();
  await page.getByRole("option", { name: "E2E account_manager", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("None assigned", { exact: true })).toBeVisible();

  await page.goto("/agency/projects");
  await page.locator("summary").filter({ hasText: "New project" }).click();
  await page.getByLabel("Client", { exact: true }).click();
  await page.getByRole("option", { name: newClientName, exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill(`E2E new project ${run}`);
  await page.getByLabel("Template", { exact: true }).click();
  await page.getByRole("option", { name: "Charity site", exact: true }).click();
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(page.getByRole("link", { name: `E2E new project ${run}`, exact: true })).toBeVisible();

  await page.getByRole("link", { name: `E2E new project ${run}`, exact: true }).click();
  await expect(page.getByText("Homepage design", { exact: true })).toBeVisible();
  await expect(page.getByText("Donation page design", { exact: true })).toBeVisible();
  await expect(page.locator('input[value="Discovery"]')).toBeVisible();
});

test("admin creates a task, filters by assignee, and reassigns it to themselves", async ({ page }) => {
  const taskTitle = `E2E task ${run}`;
  await login(page, "admin");
  await page.goto("/agency/tasks");
  await page.locator("summary").filter({ hasText: "New task" }).click();
  await page.getByLabel("Client", { exact: true }).click();
  await page.getByRole("option", { name: `E2E ${clientId}`, exact: true }).click();
  await page.getByLabel("Task title", { exact: true }).fill(taskTitle);
  await page.locator("#task-priority").click();
  await page.getByRole("option", { name: "urgent", exact: true }).click();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Due date", { exact: true }).fill(yesterday);
  await page.getByRole("button", { name: "Create task", exact: true }).click();

  await page.goto("/agency/tasks");
  await expect(page.getByText(taskTitle, { exact: true })).toHaveCount(0);

  await page.goto("/agency/tasks?assignee=all");
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(/Overdue ·/)).toBeVisible();
  const row = page.locator('[data-testid^="task-"]', { has: page.getByText(taskTitle, { exact: true }) }).first();
  await row.getByLabel("Assignees", { exact: true }).click();
  await page.getByRole("checkbox", { name: "E2E admin", exact: true }).click();
  await expect(page.getByText("Assignee updated")).toBeVisible();
  await page.getByRole("checkbox", { name: "E2E account_manager", exact: true }).click();
  await expect(page.getByText("Assignees updated")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(row.locator('[data-slot="avatar-group"]')).toHaveAttribute("aria-label", /E2E admin.*E2E account_manager/);
  await expect(row.getByText("urgent", { exact: true })).toBeVisible();
  await expect(row.getByText(/Overdue ·/)).toBeVisible();
  await row.getByTestId("task-priority-picker").click();
  await page.getByRole("button", { name: "high", exact: true }).click();
  await expect(page.getByText("Priority updated", { exact: true })).toBeVisible();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await row.getByTestId("task-due-date-picker").click();
  await page.getByLabel("Date", { exact: true }).fill(tomorrow);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Due date updated", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: `Start timer for ${taskTitle}`, exact: true }).click();
  await page.getByRole("button", { name: "Stop and log time", exact: true }).click();
  await expect(page.getByText(/Logged 00:00:0[1-9]/)).toBeVisible();
  await row.getByRole("button", { name: taskTitle, exact: true }).click();
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(page.getByText(/logged 00:00:0[1-9] to Account Manager Hours/)).toBeVisible();
  const savedAssignments = await db.query.taskAssignments.findMany({ where: eq(taskAssignments.taskId, (await db.query.tasks.findFirst({ where: eq(tasks.title, taskTitle) }))!.id) });
  expect(savedAssignments.map((assignment) => assignment.userId)).toEqual(expect.arrayContaining([actors.admin.id, actors.account_manager.id]));
  const updatedTask = await db.query.tasks.findFirst({ where: eq(tasks.title, taskTitle) });
  expect(updatedTask?.priority).toBe("high");
  expect(updatedTask?.dueDate?.toISOString().slice(0, 10)).toBe(tomorrow);

  await page.goto("/agency/tasks");
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();
});

test("client oversight uses independent unequal columns and single-line desktop task controls", async ({ page }) => {
  const layoutTaskId = randomUUID();
  const title = "Review the full delivery schedule with the client before the campaign launches";
  await db.insert(tasks).values({ id: layoutTaskId, clientAccountId: clientId, projectId, title, priority: "urgent", dueDate: new Date("2026-01-01T12:00:00Z"), assignedToUserId: actors.admin.id });
  await db.insert(timeEntries).values({ userId: actors.admin.id, clientAccountId: clientId, taskId: layoutTaskId, startedAt: new Date(), stoppedAt: new Date(), durationSeconds: 3661 });
  await login(page, "admin");
  await page.goto(`/agency/clients/${clientId}`);
  const taskSection = page.getByTestId("client-task-section");
  const budgetSection = page.getByTestId("client-budget-section");
  const context = page.getByRole("complementary", { name: "Client context" });
  const row = page.getByTestId(`task-${layoutTaskId}`);
  for (const width of [1920, 1440, 1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(row).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width >= 1440) {
      const work = (await page.getByTestId("client-work-column").boundingBox())!;
      const sidebar = (await context.boundingBox())!;
      expect(work.width).toBeGreaterThan(sidebar.width * 2);
      expect(Math.abs(work.y - sidebar.y)).toBeLessThan(2);
      const taskBounds = (await taskSection.boundingBox())!;
      expect(taskBounds.y).toBeLessThan(220);
      const budgetTop = await budgetSection.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
      await context.locator("summary").filter({ hasText: "Onboarding information" }).click();
      expect(await budgetSection.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)).toBe(budgetTop);
      await context.locator("summary").filter({ hasText: "Onboarding information" }).click();
    }
    if (width >= 1280) {
      const controls = await row.getByTestId("task-row-controls").evaluate((element) => [...element.children].map((child) => { const rect = child.getBoundingClientRect(); return rect.y + rect.height / 2; }));
      expect(Math.max(...controls) - Math.min(...controls)).toBeLessThan(3);
      expect(await row.evaluate((element) => element.scrollWidth <= element.parentElement!.clientWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: `test-results/client-layout-${width}.png`, fullPage: true });
  }
  await row.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("full interface audit across agency, portal and public routes", async ({ page }) => {
  test.skip(!process.env.UI_AUDIT, "Explicit visual audit only");
  test.setTimeout(300_000);
  const issues: string[] = [];
  const auditTaskId = randomUUID();
  await db.update(contentItems).set({ status: "pending_client" }).where(eq(contentItems.id, itemId));
  await db.insert(tasks).values({ id: auditTaskId, clientAccountId: clientId, projectId, title: "Review September delivery plan", assignedToUserId: actors.admin.id });
  const period = monthWindow();
  const ticketId = randomUUID();
  const attachmentMessageId = randomUUID();
  await db.insert(clientTimeBudgets).values([{ clientAccountId: clientId, periodStart: period.start, periodEnd: period.end, allocatedSeconds: 36000 }, { clientAccountId: otherClientId, periodStart: period.start, periodEnd: period.end, allocatedSeconds: 18000 }]);
  await db.insert(clientServiceAllocations).values([{ clientAccountId: clientId, periodStart: period.start, periodEnd: period.end, serviceType: "account_manager_hours", allocatedSeconds: 36000 }, { clientAccountId: otherClientId, periodStart: period.start, periodEnd: period.end, serviceType: "account_manager_hours", allocatedSeconds: 18000 }]);
  await db.insert(timeEntries).values([clientId, otherClientId].map((clientAccountId) => ({ userId: actors.admin.id, clientAccountId, serviceType: "account_manager_hours", taskId: clientAccountId === clientId ? auditTaskId : null, startedAt: new Date(period.start.getTime() + 86_400_000), stoppedAt: new Date(period.start.getTime() + 86_400_000 + 21653000), durationSeconds: 21653 })));
  await db.insert(tickets).values({ id: ticketId, clientAccountId: otherClientId, subject: "Delivery review and campaign launch questions" });
  await db.insert(ticketMessages).values({ id: attachmentMessageId, ticketId, body: "Please review the launch notes.", attachmentUrl: "https://fixture.private.blob.vercel-storage.com/launch.pdf", attachmentName: "launch.pdf" });
  const clientTicketId = randomUUID();
  await db.insert(tickets).values({ id: clientTicketId, clientAccountId: clientId, subject: "Client-scoped support question" });
  const groups = [
    { role: "admin", paths: ["/agency", "/agency/clients", `/agency/clients/${clientId}`, "/agency/projects", `/agency/projects/${projectId}`, "/agency/tasks", "/agency/content", `/agency/content/${itemId}`, "/agency/content/templates", "/agency/files", "/agency/designs", "/agency/support", "/agency/time", "/agency/calendar", "/agency/reports", "/agency/settings", "/agency/settings/client-types", "/agency/settings/project-templates", "/agency/settings/onboarding-flows", "/agency/preview"] },
    { role: "client", paths: ["/portal", "/portal/projects", `/portal/projects/${projectId}`, "/portal/approvals", `/portal/content/${itemId}`, "/portal/files", "/portal/support", "/portal/time", "/portal/onboarding"] },
  ];
  for (const group of groups) {
    await login(page, group.role);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of group.paths) {
        if (path === "/portal/onboarding") await db.update(clientAccounts).set({ onboardingCompletedAt: null }).where(eq(clientAccounts.id, clientId));
        const response = await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const problem = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, error: document.body.innerText.includes("Application error:") }));
        if ((response?.status() ?? 500) >= 400 || problem.overflow || problem.error) issues.push(`${width} ${path}: ${response?.status()} ${JSON.stringify(problem)}`);
        if (process.env.UI_AUDIT === "verified" && path === `/agency/clients/${clientId}`) {
          const clientTask = page.locator(`[data-testid="task-${auditTaskId}"]`);
          await expect(clientTask).toBeVisible();
          await expect(clientTask.getByTestId("task-priority-picker")).toBeVisible();
          await expect(page.getByTestId("stacked-service-progress")).toBeVisible();
          const supportSection = page.getByTestId("client-support-section");
          await expect(supportSection).toBeVisible();
          await expect(supportSection.getByText("Client-scoped support question", { exact: true })).toBeVisible();
          await expect(supportSection.getByText("Delivery review and campaign launch questions", { exact: true })).toHaveCount(0);
          expect(await supportSection.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(await clientTask.evaluate((element) => element.getBoundingClientRect().top));
        }
        const name = path.replaceAll("/", "-").replace(clientId, "client").replace(projectId, "project").replace(itemId, "content");
        await page.screenshot({ path: `test-results/audit-${process.env.UI_AUDIT}/${width}${name}.png`, fullPage: true });
        if (path === "/portal/onboarding") await db.update(clientAccounts).set({ onboardingCompletedAt: new Date() }).where(eq(clientAccounts.id, clientId));
      }
    }
    if (group.role === "admin") {
      await page.goto("/agency/tasks");
      await page.getByRole("button", { name: "Review September delivery plan", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("Checklist", { exact: true })).toBeVisible();
      const bounds = await page.getByRole("dialog").boundingBox();
      if (bounds && (bounds.y < 0 || bounds.y + bounds.height > 900)) issues.push("Task dialog extends beyond viewport");
      await page.screenshot({ path: `test-results/audit-${process.env.UI_AUDIT}/task-detail-mobile.png` });
      if (process.env.UI_AUDIT === "verified") {
        await page.getByRole("tab", { name: "Comments (0)" }).click();
        await expect(page.getByLabel("Task comment", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Close", exact: true }).last().click();
        await page.keyboard.press("Meta+k");
        await page.getByLabel("Find a page").fill("Time");
        await page.getByLabel("Find a page").press("Enter");
        await expect(page).toHaveURL(/\/agency\/time$/);
        await page.getByRole("link", { name: "Previous month", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`month=${period.previous}`));
        await expect(page.locator("h1")).toHaveText("Time & budgets");
      }
    } else if (process.env.UI_AUDIT === "verified") {
      expect((await page.request.get(`/api/files/ticket/${attachmentMessageId}`)).status()).toBe(404);
      await page.goto("/portal/time");
      await expect(page.getByRole("progressbar")).toHaveCount(6);
      await expect(page.getByText(`E2E ${otherClientId}`, { exact: true })).toHaveCount(0);
    }
  }
  await page.context().clearCookies();
  const anonymousDownload = await page.request.get(`/api/files/ticket/${attachmentMessageId}`, { maxRedirects: 0 });
  expect([401, 307]).toContain(anonymousDownload.status());
  if (anonymousDownload.status() === 307) expect(anonymousDownload.headers().location).toContain("/login");
  for (const path of ["/", "/login", "/forgot-password", "/reset-password", "/privacy", "/terms", "/security"]) {
    await page.goto(path);
    await expect(page.locator("h1, [data-slot=card-title]").first()).toBeVisible();
    await page.screenshot({ path: `test-results/audit-${process.env.UI_AUDIT}/public${path.replaceAll("/", "-")}.png`, fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) issues.push(`Public overflow: ${path}`);
  }
  console.log("UI audit findings:", JSON.stringify(issues));
  if (process.env.UI_AUDIT === "verified") expect(issues).toEqual([]);
});