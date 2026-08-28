import Image from "next/image";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { Images, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { clientAccounts, designAssets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDesign } from "./actions";

export default async function AgencyDesignsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireAgencyUser();
  const { client } = await searchParams;
  const [clients, designs] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }),
    db.query.designAssets.findMany({ orderBy: desc(designAssets.createdAt), with: { annotations: true } }),
  ]);
  const clientName = (id: string) => clients.find((item) => item.id === id)?.name ?? "Unknown client";
  const filtered = client ? designs.filter((design) => design.clientAccountId === client) : designs;
  const clientsWithDesigns = clients.filter((item) => designs.some((design) => design.clientAccountId === item.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Design reviews" description="Upload screenshots for clients to annotate and approve." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a design</CardTitle>
          <CardDescription>Use PNG, JPG, WebP or another browser-supported image.</CardDescription>
        </CardHeader>
        <CardContent><UploadForm action={uploadDesign} clients={clients} kind="design" submitLabel="Upload for review" /></CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Design assets</CardTitle>
          {clientsWithDesigns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={!client ? "default" : "outline"} asChild><Link href="/agency/designs">All</Link></Button>
              {clientsWithDesigns.map((item) => (
                <Button key={item.id} size="sm" variant={client === item.id ? "default" : "outline"} asChild><Link href={`/agency/designs?client=${item.id}`}>{item.name}</Link></Button>
              ))}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState icon={Images} title="No designs yet" description="Upload a screenshot above to start a review." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((design) => (
                <a key={design.id} href={design.imageUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-md border transition-colors hover:border-primary/40">
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    <Image src={design.imageUrl} alt={design.title} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    {design.annotations.length > 0 ? (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white"><MessageSquare className="size-3" />{design.annotations.length}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{design.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{clientName(design.clientAccountId)}</p>
                    </div>
                    <StatusBadge status={design.status} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
