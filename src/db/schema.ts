import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRole = pgEnum("user_role", ["admin", "account_manager", "content_writer", "client"]);
export const userStatus = pgEnum("user_status", ["invited", "active", "disabled"]);
export const clientStatus = pgEnum("client_status", ["prospect", "onboarding", "active", "paused"]);
export const taskStatus = pgEnum("task_status", ["open", "in_progress", "blocked", "done"]);
export const taskPriority = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const documentKind = pgEnum("document_kind", ["document", "design"]);
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "changes_requested"]);
export const ticketStatus = pgEnum("ticket_status", ["open", "pending", "resolved", "closed"]);
export const ticketPriority = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const messageChannel = pgEnum("message_channel", ["portal", "email"]);
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const contentStatus = pgEnum("content_status", ["draft", "pending_am", "am_changes", "pending_client", "client_changes", "approved", "published"]);

// ---------------------------------------------------------------------------
// Auth.js core tables (Drizzle adapter) — extended with app fields
// ---------------------------------------------------------------------------
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("client"),
  status: userStatus("status").notNull().default("invited"),
  // Client users belong to a client account. Null for agency staff.
  clientAccountId: text("client_account_id"),
  phone: text("phone"),
  title: text("title"),
  clientRole: text("client_role"),
  permissions: jsonb("permissions").notNull().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------
export const organizations = pgTable("organization", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const clientAccounts = pgTable(
  "client_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: clientStatus("status").notNull().default("onboarding"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: "date" }),
    visibleTabs: jsonb("visible_tabs").notNull().default(["dashboard", "projects", "approvals", "designs", "support"]),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("client_account_org_slug_idx").on(t.organizationId, t.slug)],
);

export const accountManagerAssignments = pgTable(
  "account_manager_assignment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assignment_unique_idx").on(t.clientAccountId, t.userId)],
);

export const onboardingSubmissions = pgTable("onboarding_submission", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientAccountId: text("client_account_id")
    .notNull()
    .references(() => clientAccounts.id, { onDelete: "cascade" })
    .unique(),
  data: jsonb("data").notNull().default({}),
  currentStep: integer("current_step").notNull().default(0),
  completedAt: timestamp("completed_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const projects = pgTable(
  "project",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id").notNull().references(() => clientAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    projectType: text("project_type").notNull().default("brochure_site"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("project_client_idx").on(t.clientAccountId)],
);

export const projectMilestones = pgTable("project_milestone", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: taskStatus("status").notNull().default("open"),
  dueDate: timestamp("due_date", { mode: "date" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const contentSubmissions = pgTable("content_submission", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  submittedByUserId: text("submitted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  pageTitle: text("page_title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const projectUpdates = pgTable("project_update", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
  updateType: text("update_type").notNull().default("note"),
  body: text("body").notNull(),
  sentiment: text("sentiment"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const designVersions = pgTable("design_version", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  designAssetId: text("design_asset_id").notNull().references(() => designAssets.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  imageUrl: text("image_url").notNull(),
  status: approvalStatus("status").notNull().default("pending"),
  approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Tasks / needs
// ---------------------------------------------------------------------------
export const tasks = pgTable(
  "task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatus("status").notNull().default("open"),
    priority: taskPriority("priority").notNull().default("medium"),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: timestamp("due_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("task_client_idx").on(t.clientAccountId)],
);

// ---------------------------------------------------------------------------
// Documents + approvals
// ---------------------------------------------------------------------------
export const documents = pgTable(
  "document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "cascade" }),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    kind: documentKind("kind").notNull().default("document"),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type"),
    size: integer("size"),
    status: approvalStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("document_client_idx").on(t.clientAccountId)],
);

export const approvals = pgTable("approval", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  clientAccountId: text("client_account_id")
    .notNull()
    .references(() => clientAccounts.id, { onDelete: "cascade" }),
  decidedByUserId: text("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
  decision: approvalStatus("decision").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Client reference files (any type, uploaded by client or agency, no approval)
// ---------------------------------------------------------------------------
export const referenceFiles = pgTable(
  "reference_file",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "cascade" }),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type"),
    size: integer("size"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("reference_file_client_idx").on(t.clientAccountId)],
);

// ---------------------------------------------------------------------------
// Content authoring: templates, items, versions, comments, events
// ---------------------------------------------------------------------------
export const contentTemplates = pgTable("content_template", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  contentType: text("content_type").notNull().default("blog"),
  // Array of { key, label, type, required, help, options }
  fields: jsonb("fields").notNull().default([]),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const contentItems = pgTable(
  "content_item",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id").notNull().references(() => clientAccounts.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    templateId: text("template_id").references(() => contentTemplates.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    contentType: text("content_type").notNull().default("blog"),
    status: contentStatus("status").notNull().default("draft"),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    currentVersion: integer("current_version").notNull().default(0),
    // Mutable working copy of field values; immutable snapshots live in content_version.
    data: jsonb("data").notNull().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("content_item_client_idx").on(t.clientAccountId), index("content_item_status_idx").on(t.status)],
);

export const contentVersions = pgTable(
  "content_version",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    contentItemId: text("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    // Snapshot of every field value keyed by template field key (richtext stored as HTML).
    data: jsonb("data").notNull().default({}),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("content_version_item_idx").on(t.contentItemId)],
);

export const contentComments = pgTable(
  "content_comment",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    contentItemId: text("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
    versionId: text("version_id").references(() => contentVersions.id, { onDelete: "set null" }),
    fieldKey: text("field_key"),
    quote: text("quote"),
    body: text("body").notNull(),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    parentId: text("parent_id"),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("content_comment_item_idx").on(t.contentItemId)],
);

export const contentEvents = pgTable(
  "content_event",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    contentItemId: text("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    type: text("type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("content_event_item_idx").on(t.contentItemId)],
);

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  template: one(contentTemplates, { fields: [contentItems.templateId], references: [contentTemplates.id] }),
  client: one(clientAccounts, { fields: [contentItems.clientAccountId], references: [clientAccounts.id] }),
  assignee: one(users, { fields: [contentItems.assignedToUserId], references: [users.id] }),
  versions: many(contentVersions),
  comments: many(contentComments),
  events: many(contentEvents),
}));

export const contentVersionsRelations = relations(contentVersions, ({ one }) => ({
  item: one(contentItems, { fields: [contentVersions.contentItemId], references: [contentItems.id] }),
  author: one(users, { fields: [contentVersions.authorUserId], references: [users.id] }),
}));

export const contentCommentsRelations = relations(contentComments, ({ one }) => ({
  item: one(contentItems, { fields: [contentComments.contentItemId], references: [contentItems.id] }),
  author: one(users, { fields: [contentComments.authorUserId], references: [users.id] }),
}));

export const contentEventsRelations = relations(contentEvents, ({ one }) => ({
  item: one(contentItems, { fields: [contentEvents.contentItemId], references: [contentItems.id] }),
  actor: one(users, { fields: [contentEvents.actorUserId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// Design review — pins + comments
// ---------------------------------------------------------------------------
export const designAssets = pgTable(
  "design_asset",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    imageUrl: text("image_url").notNull(),
    width: integer("width"),
    height: integer("height"),
    status: approvalStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("design_client_idx").on(t.clientAccountId)],
);

export const annotations = pgTable(
  "annotation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    designAssetId: text("design_asset_id")
      .notNull()
      .references(() => designAssets.id, { onDelete: "cascade" }),
    // Normalised position 0..1 relative to the image.
    x: real("x").notNull(),
    y: real("y").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("annotation_asset_idx").on(t.designAssetId)],
);

export const annotationComments = pgTable("annotation_comment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  annotationId: text("annotation_id")
    .notNull()
    .references(() => annotations.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Support ticketing
// ---------------------------------------------------------------------------
export const tickets = pgTable(
  "ticket",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientAccountId: text("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    status: ticketStatus("status").notNull().default("open"),
    priority: ticketPriority("priority").notNull().default("medium"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ticket_client_idx").on(t.clientAccountId)],
);

export const ticketMessages = pgTable(
  "ticket_message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorEmail: text("author_email"),
    body: text("body").notNull(),
    channel: messageChannel("channel").notNull().default("portal"),
    direction: messageDirection("direction").notNull().default("outbound"),
    mailgunMessageId: text("mailgun_message_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ticket_message_ticket_idx").on(t.ticketId)],
);

// ---------------------------------------------------------------------------
// Float-style calendar
// ---------------------------------------------------------------------------
export const calendarProjects = pgTable("calendar_project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  color: text("color").notNull().default("#2563eb"),
  clientAccountId: text("client_account_id").references(() => clientAccounts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const allocations = pgTable(
  "allocation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberUserId: text("member_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => calendarProjects.id, { onDelete: "set null" }),
    clientAccountId: text("client_account_id").references(() => clientAccounts.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    // Day the block belongs to; time-of-day stored as minutes from midnight.
    date: timestamp("date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }),
    startMinute: integer("start_minute").notNull().default(540),
    endMinute: integer("end_minute").notNull().default(1020),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("allocation_member_date_idx").on(t.memberUserId, t.date)],
);

// ---------------------------------------------------------------------------
// Audit log + notifications
// ---------------------------------------------------------------------------
export const auditLogs = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    clientAccountId: text("client_account_id").references(() => clientAccounts.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const notifications = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    linkUrl: text("link_url"),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notification_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [users.clientAccountId],
    references: [clientAccounts.id],
  }),
  assignments: many(accountManagerAssignments),
}));

export const clientAccountsRelations = relations(clientAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clientAccounts.organizationId],
    references: [organizations.id],
  }),
  members: many(users),
  assignments: many(accountManagerAssignments),
  onboarding: one(onboardingSubmissions),
  tasks: many(tasks),
  documents: many(documents),
  designAssets: many(designAssets),
  tickets: many(tickets),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [projects.clientAccountId],
    references: [clientAccounts.id],
  }),
  milestones: many(projectMilestones),
  contentSubmissions: many(contentSubmissions),
  updates: many(projectUpdates),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
  project: one(projects, { fields: [projectMilestones.projectId], references: [projects.id] }),
}));

export const contentSubmissionsRelations = relations(contentSubmissions, ({ one }) => ({
  project: one(projects, { fields: [contentSubmissions.projectId], references: [projects.id] }),
}));

export const projectUpdatesRelations = relations(projectUpdates, ({ one }) => ({
  project: one(projects, { fields: [projectUpdates.projectId], references: [projects.id] }),
}));

export const accountManagerAssignmentsRelations = relations(accountManagerAssignments, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [accountManagerAssignments.clientAccountId],
    references: [clientAccounts.id],
  }),
  user: one(users, {
    fields: [accountManagerAssignments.userId],
    references: [users.id],
  }),
}));

export const designAssetsRelations = relations(designAssets, ({ many }) => ({
  annotations: many(annotations),
}));

export const annotationsRelations = relations(annotations, ({ one, many }) => ({
  designAsset: one(designAssets, {
    fields: [annotations.designAssetId],
    references: [designAssets.id],
  }),
  comments: many(annotationComments),
}));

export const annotationCommentsRelations = relations(annotationComments, ({ one }) => ({
  annotation: one(annotations, {
    fields: [annotationComments.annotationId],
    references: [annotations.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [tickets.clientAccountId],
    references: [clientAccounts.id],
  }),
  messages: many(ticketMessages),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketMessages.ticketId],
    references: [tickets.id],
  }),
}));
