import { z } from "zod";

// Full onboarding payload. Most fields are optional while in progress;
// completion validation is enforced separately in the complete action.
export const onboardingSchema = z.object({
  // Step 1 — Company
  legalName: z.string().optional().default(""),
  tradingName: z.string().optional().default(""),
  website: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  companySize: z.string().optional().default(""),
  address: z.string().optional().default(""),
  // Step 2 — Contacts
  primaryContactName: z.string().optional().default(""),
  primaryContactRole: z.string().optional().default(""),
  primaryContactEmail: z.string().optional().default(""),
  primaryContactPhone: z.string().optional().default(""),
  billingContactName: z.string().optional().default(""),
  billingContactEmail: z.string().optional().default(""),
  // Step 3 — Brand
  brandColors: z.string().optional().default(""),
  fonts: z.string().optional().default(""),
  brandAssetLinks: z.string().optional().default(""),
  brandNotes: z.string().optional().default(""),
  // Step 4 — Goals
  objectives: z.string().optional().default(""),
  targetAudience: z.string().optional().default(""),
  competitors: z.string().optional().default(""),
  keyDeliverables: z.string().optional().default(""),
  targetDate: z.string().optional().default(""),
  // Step 5 — Access
  domainRegistrar: z.string().optional().default(""),
  hosting: z.string().optional().default(""),
  cms: z.string().optional().default(""),
  analytics: z.string().optional().default(""),
  socialHandles: z.string().optional().default(""),
  // Step 6 — Preferences + agreement
  commsPreference: z.string().optional().default(""),
  meetingCadence: z.string().optional().default(""),
  acceptedTerms: z.boolean().optional().default(false),
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

export type FieldType = "text" | "url" | "email" | "tel" | "textarea" | "select" | "checkbox";

export type OnboardingField = {
  name: keyof OnboardingData;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  help?: string;
};

export type OnboardingStep = {
  title: string;
  description: string;
  fields: OnboardingField[];
};

export const onboardingSteps: OnboardingStep[] = [
  {
    title: "Company details",
    description: "Tell us about your business.",
    fields: [
      { name: "legalName", label: "Legal company name", type: "text", required: true },
      { name: "tradingName", label: "Trading name", type: "text" },
      { name: "website", label: "Website", type: "url", placeholder: "https://" },
      {
        name: "industry",
        label: "Industry",
        type: "text",
        placeholder: "e.g. Hospitality, SaaS, Retail",
      },
      {
        name: "companySize",
        label: "Company size",
        type: "select",
        options: ["1-10", "11-50", "51-200", "201-500", "500+"],
      },
      { name: "address", label: "Business address", type: "textarea" },
    ],
  },
  {
    title: "Key contacts",
    description: "Who should we work with day to day?",
    fields: [
      { name: "primaryContactName", label: "Primary contact name", type: "text", required: true },
      { name: "primaryContactRole", label: "Role / job title", type: "text" },
      { name: "primaryContactEmail", label: "Primary contact email", type: "email", required: true },
      { name: "primaryContactPhone", label: "Primary contact phone", type: "tel" },
      { name: "billingContactName", label: "Billing contact name", type: "text" },
      { name: "billingContactEmail", label: "Billing contact email", type: "email" },
    ],
  },
  {
    title: "Brand",
    description: "Help us stay on-brand.",
    fields: [
      { name: "brandColors", label: "Brand colours", type: "text", placeholder: "#123456, #abcdef" },
      { name: "fonts", label: "Brand fonts", type: "text" },
      {
        name: "brandAssetLinks",
        label: "Links to logos / brand guidelines",
        type: "textarea",
        help: "Paste any share links (Drive, Dropbox, etc.). File uploads coming soon.",
      },
      { name: "brandNotes", label: "Anything else about your brand", type: "textarea" },
    ],
  },
  {
    title: "Goals",
    description: "What does success look like?",
    fields: [
      { name: "objectives", label: "Primary objectives", type: "textarea", required: true },
      { name: "targetAudience", label: "Target audience", type: "textarea" },
      { name: "competitors", label: "Key competitors", type: "textarea" },
      { name: "keyDeliverables", label: "Key deliverables", type: "textarea" },
      { name: "targetDate", label: "Target launch / deadline", type: "text", placeholder: "e.g. Q3 2026" },
    ],
  },
  {
    title: "Accounts & access",
    description: "Where things live today (no passwords, please).",
    fields: [
      { name: "domainRegistrar", label: "Domain registrar", type: "text" },
      { name: "hosting", label: "Hosting provider", type: "text" },
      { name: "cms", label: "CMS / platform", type: "text" },
      { name: "analytics", label: "Analytics tools", type: "text" },
      { name: "socialHandles", label: "Social media handles", type: "textarea" },
    ],
  },
  {
    title: "Preferences",
    description: "Final touches.",
    fields: [
      {
        name: "commsPreference",
        label: "Preferred communication",
        type: "select",
        options: ["Email", "Phone", "Video call", "In platform"],
      },
      {
        name: "meetingCadence",
        label: "Meeting cadence",
        type: "select",
        options: ["Weekly", "Fortnightly", "Monthly", "As needed"],
      },
      {
        name: "acceptedTerms",
        label: "I confirm the information above is accurate.",
        type: "checkbox",
        required: true,
      },
    ],
  },
];

// Fields that must be present for onboarding to be considered complete.
export const requiredForCompletion: (keyof OnboardingData)[] = [
  "legalName",
  "primaryContactName",
  "primaryContactEmail",
  "objectives",
];
