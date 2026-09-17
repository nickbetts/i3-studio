export type DeliverableType = "design" | "content" | "document";

export type ProjectMilestoneTemplate = {
  title: string;
  defaultOffsetDays?: number;
};

export type ProjectDeliverableTemplate = {
  type: DeliverableType;
  title: string;
  description?: string;
  standard: boolean;
};

export type DefaultProjectTemplate = {
  name: string;
  clientTypeKey: string | null;
  milestones: ProjectMilestoneTemplate[];
  deliverables: ProjectDeliverableTemplate[];
};

// Seeded defaults carrying over today's hardcoded milestone lists (src/app/agency/projects/actions.ts)
// plus example required-deliverable checklists (e.g. the charity brief: which designs are standard).
export const DEFAULT_PROJECT_TEMPLATES: DefaultProjectTemplate[] = [
  {
    name: "Brochure site",
    clientTypeKey: "corporate",
    milestones: [{ title: "Discovery" }, { title: "Design approval" }, { title: "Build" }, { title: "Content" }, { title: "Launch" }],
    deliverables: [
      { type: "design", title: "Homepage design", standard: true },
      { type: "design", title: "Key page templates", standard: true },
    ],
  },
  {
    name: "Charity site",
    clientTypeKey: "charity",
    milestones: [{ title: "Discovery" }, { title: "Homepage and key pages" }, { title: "Fundraising templates" }, { title: "Content migration" }, { title: "Launch" }],
    deliverables: [
      { type: "design", title: "Homepage design", standard: true },
      { type: "design", title: "Donation page design", standard: true },
      { type: "design", title: "Appeal/campaign landing page", description: "Only needed for clients running a specific appeal.", standard: false },
      { type: "content", title: "Key page copy (About, Get Involved, Contact)", standard: true },
    ],
  },
  {
    name: "Ecommerce",
    clientTypeKey: "ecommerce",
    milestones: [{ title: "Discovery" }, { title: "UX and design approval" }, { title: "Catalogue and checkout" }, { title: "Content and products" }, { title: "Launch" }],
    deliverables: [
      { type: "design", title: "Product listing page design", standard: true },
      { type: "design", title: "Checkout flow design", standard: true },
    ],
  },
  {
    name: "Campaign",
    clientTypeKey: "campaign",
    milestones: [{ title: "Brief" }, { title: "Creative approval" }, { title: "Build" }, { title: "Review" }, { title: "Launch" }],
    deliverables: [{ type: "design", title: "Key campaign creative", standard: true }],
  },
];

