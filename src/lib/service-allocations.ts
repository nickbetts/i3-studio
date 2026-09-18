export const SERVICE_ALLOCATIONS = [
  { key: "account_manager_hours", label: "Account Manager Hours", kind: "hours" },
  { key: "seo_content_pieces", label: "SEO Content Pieces", kind: "quantity" },
  { key: "aeo_geo_content_pieces", label: "AEO/GEO Content Pieces", kind: "quantity" },
  { key: "proofing_hours", label: "Proofing Hours", kind: "hours" },
  { key: "links", label: "Links", kind: "quantity" },
  { key: "technical_hours", label: "Technical Hours", kind: "hours" },
  { key: "email_hours", label: "Email Hours", kind: "hours" },
  { key: "ppc_hours", label: "PPC Hours", kind: "hours" },
  { key: "social_hours", label: "Social Hours", kind: "hours" },
] as const;

export type ServiceAllocationKey = (typeof SERVICE_ALLOCATIONS)[number]["key"];
export type ServiceAllocationKind = (typeof SERVICE_ALLOCATIONS)[number]["kind"];

export function serviceAllocation(key: string) {
  return SERVICE_ALLOCATIONS.find((service) => service.key === key) ?? SERVICE_ALLOCATIONS[0];
}
