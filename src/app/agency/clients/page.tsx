import { asc, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { Users } from "lucide-react";
import { db } from "@/db";
import { clientAccounts, clientTypes } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createClient } from "./actions";
import { CreatePanel } from "@/components/create-panel";

const PAGE_SIZE = 10;

export default async function AgencyClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAgencyUser();
  const { q, page } = await searchParams;
  const [clients, managers, types] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.createdAt) }),
    db.query.users.findMany({ where: (user, { eq }) => eq(user.role, "account_manager") }),
    db.query.clientTypes.findMany({ where: (type, { eq }) => eq(type.archived, false), orderBy: asc(clientTypes.label) }),
  ]);
  const query = (q ?? "").toLowerCase();
  const filtered = query ? clients.filter((client) => client.name.toLowerCase().includes(query) || client.slug.toLowerCase().includes(query)) : clients;
  const currentPage = Math.max(1, Number(page) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Manage accounts, access and work requests." />
      <div className="space-y-6">
        <CreatePanel title="New client"><Card>
          <CardHeader><CardTitle className="text-base">Add a client</CardTitle><CardDescription>Create an account and their first login.</CardDescription></CardHeader>
          <CardContent>
            <form action={createClient} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="client-name">Company name</Label><Input id="client-name" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="client-email">Client email</Label><Input id="client-email" name="email" type="email" required /></div>
              <div className="space-y-2"><Label htmlFor="client-password">Temporary password</Label><Input id="client-password" name="password" type="password" minLength={8} required /></div>
              <div className="space-y-2"><Label htmlFor="client-type">Client type</Label><Select name="clientTypeId"><SelectTrigger id="client-type"><SelectValue placeholder="No specific type" /></SelectTrigger><SelectContent>{types.map((type) => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="client-manager">Account manager</Label><Select name="managerId"><SelectTrigger id="client-manager"><SelectValue placeholder="Assign later" /></SelectTrigger><SelectContent>{managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name || manager.email}</SelectItem>)}</SelectContent></Select></div>
              <Button type="submit">Create client</Button>
            </form>
          </CardContent>
        </Card></CreatePanel>
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><CardTitle className="text-base">Client accounts</CardTitle><CardDescription>{filtered.length} matching account{filtered.length === 1 ? "" : "s"}.</CardDescription></div>
              <SearchInput placeholder="Search clients…" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pageItems.length === 0 ? (
              <EmptyState icon={Users} title="No clients found" description={query ? "Try a different search." : "No client accounts yet."} />
            ) : pageItems.map((client) => <div key={client.id} className="flex items-center justify-between rounded-md border p-3"><div><Link href={`/agency/clients/${client.id}`} className="font-medium underline-offset-4 hover:underline">{client.name}</Link><p className="text-xs text-muted-foreground">{client.slug}</p></div><Badge variant="outline" className="capitalize">{client.status}</Badge></div>)}
            <Pagination page={currentPage} totalPages={totalPages} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

