CREATE TABLE "content_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"submitted_by_user_id" text,
	"page_title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_version" (
	"id" text PRIMARY KEY NOT NULL,
	"design_asset_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"image_url" text NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"due_date" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_update" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"author_user_id" text,
	"update_type" text DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"sentiment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"client_account_id" text NOT NULL,
	"name" text NOT NULL,
	"project_type" text DEFAULT 'brochure_site' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_submission" ADD CONSTRAINT "content_submission_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submission" ADD CONSTRAINT "content_submission_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_version" ADD CONSTRAINT "design_version_design_asset_id_design_asset_id_fk" FOREIGN KEY ("design_asset_id") REFERENCES "public"."design_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_version" ADD CONSTRAINT "design_version_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestone" ADD CONSTRAINT "project_milestone_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_update" ADD CONSTRAINT "project_update_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_update" ADD CONSTRAINT "project_update_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_client_account_id_client_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_client_idx" ON "project" USING btree ("client_account_id");