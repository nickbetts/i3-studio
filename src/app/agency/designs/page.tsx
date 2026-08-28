import { desc } from "drizzle-orm";
import Link from "next/link";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { UploadForm } from "@/components/upload-form";
import { DesignCanvasDialog } from "@/components/design-review/design-canvas-dialog";
import { db } from "@/db";
import { clientAccounts, designAssets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDesign } from "./actions";

export default async function AgencyDesignsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const actor = await requireAgencyUser();
  const { client } = await searchParams;
  const [clients, designs] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }),
    db.query.designAssets.findMany({
      orderBy: desc(designAssets.createdAt),
      with: {
        annotations: { with: { comments: { with: { author: true } } } },
        versions: { orderBy: (version, { desc: descOrder }) => [descOrder(version.version)] },
      },
    }),
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
                <DesignCanvasDialog
                  key={design.id}
                  designId={design.id}
                  imageUrl={design.imageUrl}
                  title={design.title}
                  status={design.status}
                  subtitle={clientName(design.clientAccountId)}
                  annotations={design.annotations.map((annotation) => ({
                    ...annotation,
                    comments: annotation.comments.map((comment) => ({ ...comment, authorName: comment.author?.name ?? comment.author?.email ?? null, authorRole: comment.author?.role ?? null })),
                  }))}
                  versions={design.versions.length ? design.versions : [{ version: 1, imageUrl: design.imageUrl, status: design.status, createdAt: design.createdAt }]}
                  canUploadVersion
                  canDelete={actor.role === "admin"}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
