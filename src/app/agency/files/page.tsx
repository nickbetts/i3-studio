import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { clientAccounts, documents } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDocument } from "./actions";

export default async function AgencyFilesPage() {
  await requireAgencyUser();
  const [clients, files] = await Promise.all([db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }), db.query.documents.findMany({ orderBy: desc(documents.createdAt) })]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Files & approvals</h1><p className="text-muted-foreground">Share documents with clients for review.</p></div><Card><CardHeader><CardTitle className="text-base">Upload a file</CardTitle><CardDescription>Word documents, PDFs and other client deliverables are stored in Vercel Blob.</CardDescription></CardHeader><CardContent><UploadForm action={uploadDocument} clients={clients} kind="document" submitLabel="Upload for approval" /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Shared files</CardTitle></CardHeader><CardContent className="space-y-3">{files.length === 0 ? <p className="text-sm text-muted-foreground">No files uploaded yet.</p> : files.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"><div><a className="font-medium underline-offset-4 hover:underline" href={file.fileUrl} target="_blank" rel="noreferrer">{file.title}</a><p className="text-xs text-muted-foreground">{clients.find((client) => client.id === file.clientAccountId)?.name ?? "Unknown client"} · {file.fileName}</p></div><Badge variant="outline" className="capitalize">{file.status.replace("_", " ")}</Badge></div>)}</CardContent></Card></div>;
}
