import { asc } from "drizzle-orm";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/db";
import { clientTypes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { createClientType, setClientTypeArchived } from "./actions";

export default async function ClientTypesPage() {
  await requireAdmin();
  const types = await db.query.clientTypes.findMany({ orderBy: asc(clientTypes.label) });

  return (
    <div className="space-y-6">
      <PageHeader title="Client types" description="Used when adding a client, and to pick default project templates and onboarding flows." breadcrumbs={[{ label: "Settings", href: "/agency/settings" }, { label: "Client types" }]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New client type</CardTitle>
          <CardDescription>e.g. Charity, Ecommerce, Corporate.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createClientType} className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="ct-label">Name</Label>
              <Input id="ct-label" name="label" required />
            </div>
            <div className="flex items-end"><Button type="submit">Add client type</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All client types</CardTitle></CardHeader>
        <CardContent>
          {types.length === 0 ? (
            <EmptyState icon={Tags} title="No client types yet" description="Add one above to start using it when creating clients." />
          ) : (
            <div className="divide-y">
              {types.map((type) => (
                <div key={type.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.label}</span>
                    {type.archived ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <form action={setClientTypeArchived}>
                    <input type="hidden" name="id" value={type.id} />
                    <input type="hidden" name="archived" value={String(!type.archived)} />
                    <Button type="submit" variant="ghost" size="sm">{type.archived ? "Restore" : "Archive"}</Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
