import { describe, expect, it } from "vitest";
import { canEditContent, canReadContent, canReviewContent } from "@/lib/content-policy";

const writer = { id: "writer", role: "content_writer" };
const manager = { id: "manager", role: "account_manager" };
const item = { status: "draft" as const, clientAccountId: "client-a", assignedToUserId: "writer", createdByUserId: "writer" };
describe("content permissions", () => {
  it("limits writers to assigned drafts", () => {
    expect(canEditContent(writer, item)).toBe(true);
    expect(canEditContent({ ...writer, id: "other" }, item)).toBe(false);
  });
  it.each(["pending_am", "pending_client", "approved", "published"] as const)("locks %s against draft overwrites", (status) => {
    expect(canEditContent(manager, { ...item, status })).toBe(false);
  });
  it("requires a second person for AM approval", () => {
    const review = { ...item, status: "pending_am" as const };
    expect(canReviewContent(manager, review, manager.id)).toBe(false);
    expect(canReviewContent(manager, review, writer.id)).toBe(true);
    expect(canReviewContent(writer, review, manager.id)).toBe(false);
  });
  it("denies cross-client and unreleased content", () => {
    const client = { id: "client", role: "client", clientAccountId: "client-a" };
    expect(canReadContent(client, item)).toBe(false);
    expect(canReadContent(client, { ...item, status: "pending_client" })).toBe(true);
    expect(canReadContent({ ...client, clientAccountId: "client-b" }, { ...item, status: "pending_client" })).toBe(false);
  });
});