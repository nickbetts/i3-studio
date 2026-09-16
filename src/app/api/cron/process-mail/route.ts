import { NextResponse } from "next/server";
import { cleanupMailAndSecurityRecords, processMail } from "@/lib/mailgun";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [mail] = await Promise.all([processMail(), cleanupMailAndSecurityRecords()]);
  return NextResponse.json(mail);
}