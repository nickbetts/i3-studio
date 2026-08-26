import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { clientAccounts, documents } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDocument } from "./actions";

export default async function AgencyFilesPage() {
  await requireAgencyUser();
  const [clients, files] = await Promise.all([db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }), db.query.documents.findMany({ orderBy: desc(documents.createdAt) })]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Files & approvals</h1><p className="text-muted-foreground">Share documents with clients for review.</p></div><Card><CardHeader><CardTitle className="text-base">Upload a file</CardTitle><CardDescription>Word documents, PDFs and other client deliverables are stored in Vercel Blob.</CardDescription></CardHeader><CardContent><form action={uploadDocument} className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="file-client">Client</Label><Select name="clientAccountId" required><SelectTrigger id="file-client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="file-title">Title</Label><Input id="file-title" name="title" required /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="file-description">Description</Label><Textarea id="file-description" name="description" /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="file">File</Label><Input id="file" name="file" type="file" required /></div><div><Button type="submit">Upload for approval</Button></div></form></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Shared files</CardTitle></CardHeader><CardContent className="space-y-3">{files.length === 0 ? <p className="text-sm text-muted-foreground">No files uploaded yet.</p> : files.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"><div><a className="font-medium underline-offset-4 hover:underline" href={file.fileUrl} target="_blank" rel="noreferrer">{file.title}</a><p className="text-xs text-muted-foreground">{clients.find((client) => client.id === file.clientAccountId)?.name ?? "Unknown client"} · {file.fileName}</p></div><Badge variant="outline" className="capitalize">{file.status.replace("_", " ")}</Badge></div>)}</CardContent></Card></div>;
}
