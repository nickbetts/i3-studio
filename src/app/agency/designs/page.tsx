import Image from "next/image";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { clientAccounts, designAssets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDesign } from "./actions";

export default async function AgencyDesignsPage() {
  await requireAgencyUser();
  const [clients, designs] = await Promise.all([db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }), db.query.designAssets.findMany({ orderBy: desc(designAssets.createdAt) })]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Design reviews</h1><p className="text-muted-foreground">Upload screenshots for clients to annotate and approve.</p></div><Card><CardHeader><CardTitle className="text-base">Upload a design</CardTitle><CardDescription>Use PNG, JPG, WebP or another browser-supported image.</CardDescription></CardHeader><CardContent><UploadForm action={uploadDesign} clients={clients} kind="design" submitLabel="Upload for review" /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Design assets</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{designs.length === 0 ? <p className="text-sm text-muted-foreground">No designs uploaded yet.</p> : designs.map((design) => <a key={design.id} href={design.imageUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-md border transition-colors hover:border-primary/40"><div className="relative aspect-video w-full overflow-hidden bg-muted"><Image src={design.imageUrl} alt={design.title} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-105" /></div><div className="flex items-center justify-between gap-2 p-3"><span className="truncate text-sm font-medium">{design.title}</span><Badge variant="outline" className="capitalize">{design.status}</Badge></div></a>)}</CardContent></Card></div>;
}
