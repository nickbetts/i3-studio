import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { validMailgunSignature } from "@/lib/webhook-signature";
const now = 1_800_000_000_000;
const timestamp = String(now / 1000);
const token = "sufficiently-long-test-token";
const key = "test-only-signing-key";
const signature = createHmac("sha256", key).update(timestamp + token).digest("hex");
it("accepts fresh signed webhook requests", () => { expect(validMailgunSignature(timestamp, token, signature, key, now)).toBe(true); });
it("rejects stale, missing-key and forged requests", () => {
  expect(validMailgunSignature(timestamp, token, signature, key, now + 301000)).toBe(false);
  expect(validMailgunSignature(timestamp, token, signature, undefined, now)).toBe(false);
  expect(validMailgunSignature(timestamp, token, "f".repeat(64), key, now)).toBe(false);
});
it("rejects malformed signatures without throwing", () => { expect(validMailgunSignature(timestamp, token, "not-hex", key, now)).toBe(false); });