import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), cookie: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/db", () => ({ db: { query: { users: { findFirst: mocks.find } } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }), headers: async () => new Headers({ "next-action": "test" }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getCurrentUser, requireAdmin, requireClientUser } from "@/lib/auth-helpers";
import { credentialVersion } from "@/lib/credential-version";

const active = { id: "member", role: "account_manager", status: "active", name: "Member", clientAccountId: null };

beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: active.id, role: "admin", credentialVersion: credentialVersion(null) } }); });
describe("live authorization", () => {
  it("rejects deleted users with a valid old JWT", async () => {
    mocks.find.mockResolvedValue(undefined);
    expect(await getCurrentUser()).toBeNull();
  });
  it("rejects disabled users with an old JWT", async () => {
    mocks.find.mockResolvedValue({ ...active, status: "disabled" });
    expect(await getCurrentUser()).toBeNull();
  });
  it("honors role revocation instead of trusting JWT roles", async () => {
    mocks.find.mockResolvedValue(active);
    await expect(requireAdmin()).rejects.toThrow("redirect:/agency");
  });
  it("ignores forged preview cookies for non-admins", async () => {
    mocks.find.mockResolvedValue(active); mocks.cookie.mockReturnValue({ value: "admin" });
    expect(await getCurrentUser()).toEqual(active);
    expect(mocks.find).toHaveBeenCalledTimes(1);
  });
  it("scopes client requests to a linked account", async () => {
    mocks.find.mockResolvedValue({ ...active, role: "client" });
    await expect(requireClientUser()).rejects.toThrow("redirect:/agency");
  });
  it("selects only safe user fields", async () => {
    mocks.find.mockResolvedValue(active);
    await getCurrentUser();
    expect(await getCurrentUser()).not.toHaveProperty("passwordHash");
  });
  it("rejects sessions issued before a password change", async () => {
    mocks.find.mockResolvedValue({ ...active, passwordHash: "changed" });
    expect(await getCurrentUser()).toBeNull();
  });
  it("blocks mutations in administrator preview mode", async () => {
    mocks.find.mockResolvedValue({ ...active, role: "admin" }); mocks.cookie.mockReturnValue({ value: "client" });
    await expect(getCurrentUser()).rejects.toThrow("Exit preview");
  });
});