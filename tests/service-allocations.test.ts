import { describe, expect, it } from "vitest";
import { SERVICE_ALLOCATIONS, serviceAllocation } from "../src/lib/service-allocations";

describe("monthly service allocations", () => {
  it("contains the agreed hour and quantity services", () => {
    expect(SERVICE_ALLOCATIONS.map((service) => service.label)).toEqual([
      "Account Manager Hours",
      "SEO Content Pieces",
      "AEO/GEO Content Pieces",
      "Proofing Hours",
      "Links",
      "Technical Hours",
      "Email Hours",
      "PPC Hours",
      "Social Hours",
    ]);
    expect(SERVICE_ALLOCATIONS.filter((service) => service.kind === "hours")).toHaveLength(6);
    expect(SERVICE_ALLOCATIONS.filter((service) => service.kind === "quantity")).toHaveLength(3);
  });

  it("falls back safely for an unknown service key", () => {
    expect(serviceAllocation("unknown")).toEqual(SERVICE_ALLOCATIONS[0]);
  });
});
