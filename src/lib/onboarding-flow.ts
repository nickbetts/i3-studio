// Bump when Terms of Use / Privacy Policy content materially changes so past acceptances stay attributable to the version shown.
export const CURRENT_TERMS_VERSION = "2026-09-17";

export type OnboardingFlowFieldType = "text" | "url" | "email" | "tel" | "textarea" | "select" | "checkbox";

export type OnboardingFlowField = {
  key: string;
  label: string;
  type: OnboardingFlowFieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  help?: string;
};

export type OnboardingFlowStep = {
  title: string;
  description: string;
  fields: OnboardingFlowField[];
};

// Mirrors today's fixed onboarding form (src/lib/onboarding.ts) so the seeded
// default flow behaves identically until the wizard is wired to flows in Phase 3.
export const DEFAULT_ONBOARDING_FLOW_STEPS: OnboardingFlowStep[] = [
  {
    title: "Company details",
    description: "Tell us about your business.",
    fields: [
      { key: "legalName", label: "Legal company name", type: "text", required: true },
      { key: "tradingName", label: "Trading name", type: "text" },
      { key: "website", label: "Website", type: "url", placeholder: "https://" },
      { key: "industry", label: "Industry", type: "text", placeholder: "e.g. Hospitality, SaaS, Retail" },
      { key: "companySize", label: "Company size", type: "select", options: ["1-10", "11-50", "51-200", "201-500", "500+"] },
      { key: "address", label: "Business address", type: "textarea" },
    ],
  },
  {
    title: "Key contacts",
    description: "Who should we work with day to day?",
    fields: [
      { key: "primaryContactName", label: "Primary contact name", type: "text", required: true },
      { key: "primaryContactRole", label: "Role / job title", type: "text" },
      { key: "primaryContactEmail", label: "Primary contact email", type: "email", required: true },
      { key: "primaryContactPhone", label: "Primary contact phone", type: "tel" },
      { key: "billingContactName", label: "Billing contact name", type: "text" },
      { key: "billingContactEmail", label: "Billing contact email", type: "email" },
    ],
  },
  {
    title: "Brand",
    description: "Help us stay on-brand.",
    fields: [
      { key: "brandColors", label: "Brand colours", type: "text", placeholder: "#123456, #abcdef" },
      { key: "fonts", label: "Brand fonts", type: "text" },
      { key: "brandAssetLinks", label: "Links to logos / brand guidelines", type: "textarea", help: "Paste any share links (Drive, Dropbox, etc.). File uploads coming soon." },
      { key: "brandNotes", label: "Anything else about your brand", type: "textarea" },
    ],
  },
  {
    title: "Goals",
    description: "What does success look like?",
    fields: [
      { key: "objectives", label: "Primary objectives", type: "textarea", required: true },
      { key: "targetAudience", label: "Target audience", type: "textarea" },
      { key: "competitors", label: "Key competitors", type: "textarea" },
      { key: "keyDeliverables", label: "Key deliverables", type: "textarea" },
      { key: "targetDate", label: "Target launch / deadline", type: "text", placeholder: "e.g. Q3 2026" },
    ],
  },
  {
    title: "Accounts & access",
    description: "Where things live today (no passwords, please).",
    fields: [
      { key: "domainRegistrar", label: "Domain registrar", type: "text" },
      { key: "hosting", label: "Hosting provider", type: "text" },
      { key: "cms", label: "CMS / platform", type: "text" },
      { key: "analytics", label: "Analytics tools", type: "text" },
      { key: "socialHandles", label: "Social media handles", type: "textarea" },
    ],
  },
  {
    title: "Preferences",
    description: "Final touches.",
    fields: [
      { key: "commsPreference", label: "Preferred communication", type: "select", options: ["Email", "Phone", "Video call", "In platform"] },
      { key: "meetingCadence", label: "Meeting cadence", type: "select", options: ["Weekly", "Fortnightly", "Monthly", "As needed"] },
      { key: "acceptedTerms", label: "I confirm the information above is accurate.", type: "checkbox", required: true },
    ],
  },
];
