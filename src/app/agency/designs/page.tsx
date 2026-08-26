import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/db";
import { clientAccounts, designAssets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDesign } from "./actions";

export default async function AgencyDesignsPage() {
  await requireAgencyUser();
  const [clients, designs] = await Promise.all([db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }), db.query.designAssets.findMany({ orderBy: desc(designAssets.createdAt) })]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Design reviews</h1><p className="text-muted-foreground">Upload screenshots for clients to annotate and approve.</p></div><Card><CardHeader><CardTitle className="text-base">Upload a design</CardTitle><CardDescription>Use PNG, JPG, WebP or another browser-supported image.</CardDescription></CardHeader><CardContent><form action={uploadDesign} className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="design-client">Client</Label><Select name="clientAccountId" required><SelectTrigger id="design-client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="design-title">Title</Label><Input id="design-title" name="title" required /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="design-file">Screenshot</Label><Input id="design-file" name="file" type="file" accept="image/*" required /></div><div><Button type="submit">Upload for review</Button></div></form></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Design assets</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{designs.length === 0 ? <p className="text-sm text-muted-foreground">No designs uploaded yet.</p> : designs.map((design) => <a key={design.id} href={design.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border"><img src={design.imageUrl} alt={design.title} className="aspect-video w-full object-cover" /><div className="flex items-center justify-between gap-2 p-3"><span className="truncate text-sm font-medium">{design.title}</span><Badge variant="outline" className="capitalize">{design.status}</Badge></div></a>)}</CardContent></Card></div>;
}
