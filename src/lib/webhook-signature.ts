import { createHmac, timingSafeEqual } from "node:crypto";

export function validMailgunSignature(timestamp: string, token: string, signature: string, key: string | undefined, now = Date.now()) {
  if (!key || !/^\d{10}$/.test(timestamp) || token.length < 16 || token.length > 200 || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", key).update(timestamp + token).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}