import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { designAssets } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { DesignReview } from "./design-review";

export default async function PortalDesignsPage() {
  const user = await requireClientUser();
  const designs = await db.query.designAssets.findMany({ where: eq(designAssets.clientAccountId, user.clientAccountId), orderBy: desc(designAssets.createdAt), with: { annotations: { with: { comments: true } } } });
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Design reviews</h1><p className="text-muted-foreground">Click anywhere on a design to leave a pin and comment.</p></div>{designs.length === 0 ? <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No designs are waiting for review.</p></CardContent></Card> : designs.map((design) => <Card key={design.id}><CardHeader><CardTitle className="text-base">{design.title}</CardTitle><CardDescription>Review comments and resolve pins when addressed.</CardDescription></CardHeader><CardContent><DesignReview designId={design.id} imageUrl={design.imageUrl} title={design.title} annotations={design.annotations} /></CardContent></Card>)}</div>;
}
