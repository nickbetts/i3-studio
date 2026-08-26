type SendMailInput = { to: string; subject: string; text: string; replyTo?: string };

export async function sendMail(input: SendMailInput) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.SUPPORT_INBOUND_ADDRESS;
  if (!apiKey || !domain || !from) return { skipped: true };
  const base = process.env.MAILGUN_API_BASE || "https://api.mailgun.net";
  const body = new URLSearchParams({ from, to: input.to, subject: input.subject, text: input.text });
  if (input.replyTo) body.set("h:Reply-To", input.replyTo);
  const response = await fetch(`${base}/v3/${domain}/messages`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Mailgun request failed: ${response.status}`);
  return response.json() as Promise<{ id: string }>;
}
