import { createCipheriv, publicEncrypt, randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs3u83EY6I3kL7FB0g4FC
bkeNqbslgV+2Zz1P9zKBsfQ9+vByYaf9GhEdDDCg8HQK6eqc8GKRLhN1Ily+lvCM
a+EDdpNUUP0jmmYLc7YbBFGLuej/6Pv9OeL+ICw55FcWTvaFv+DWYUzByx7plwek
uS+g5tvZVP4NDh5WbepZXGVGEymQfi+3CXkfQffr2xfg/+yk7UE5wRdqDRBgrowf
35O5e3MEPFs9mAIVn1zbgvVAHXdYCN8MGag6tz76CbeklfvJP/+uU32uPUTIsGKv
KTI6jMOcvL/eOIDsqJl5XkV/dX5U5GqOGwMGJcrSDXTLJ1Er8HY9gc50UfXba51g
gQIDAQAB
-----END PUBLIC KEY-----`;

const ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "AUTH_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_PRIVATE_READ_WRITE_TOKEN",
  "CRON_SECRET",
] as const;

export function GET() {
  const payload = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key] ?? ""]));
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);

  return Response.json(
    {
      key: publicEncrypt(PUBLIC_KEY, key).toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}