import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { DecisionForm } from "./decision-form";

export default async function PortalApprovalsPage() {
  const user = await requireClientUser();
  const files = await db.query.documents.findMany({ where: eq(documents.clientAccountId, user.clientAccountId), orderBy: desc(documents.createdAt) });
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Approvals</h1><p className="text-muted-foreground">Review files shared by your team and leave a decision.</p></div><div className="space-y-4">{files.length === 0 ? <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Nothing has been shared for approval yet.</p></CardContent></Card> : files.map((file) => <Card key={file.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{file.title}</CardTitle><CardDescription>{file.description || file.fileName}</CardDescription></div><Badge variant={file.status === "approved" ? "default" : file.status === "changes_requested" ? "destructive" : "secondary"} className="capitalize">{file.status.replace("_", " ")}</Badge></div></CardHeader><CardContent className="space-y-4"><a className="text-sm underline underline-offset-4" href={file.fileUrl} target="_blank" rel="noreferrer">Open {file.fileName}</a>{file.status === "pending" ? <DecisionForm documentId={file.id} /> : <p className="text-sm text-muted-foreground">This item has been {file.status.replace("_", " ")}.</p>}</CardContent></Card>)}</div></div>;
}
