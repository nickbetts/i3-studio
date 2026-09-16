import { createHash } from "node:crypto";

export function credentialVersion(passwordHash: string | null) {
  return createHash("sha256").update(passwordHash ?? "disabled").digest("hex");
}