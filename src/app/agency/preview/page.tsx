import { ArrowLeft, CheckCircle2, FileText, FolderKanban, LifeBuoy, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-helpers";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await requireAdmin();
  const role = (await searchParams).role === "account_manager" ? "Account manager" : "Client";
  const items = role === "Client" ? [[FolderKanban, "Projects", "Milestones and content submissions"], [CheckCircle2, "Approvals", "Files waiting for your decision"], [LifeBuoy, "Support", "Questions and replies"]] : [[Users, "Clients", "Accounts and assigned work"], [FolderKanban, "Projects", "Delivery workspaces"], [FileText, "Files", "Shared approvals"]];
  return <div className="space-y-6"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href="/agency"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-2xl font-semibold">Preview: {role}</h1><p className="text-muted-foreground">A read-only view of the navigation and experience for this role.</p></div></div><div className="grid gap-4 md:grid-cols-3">{items.map(([Icon, title, description]) => <Card key={title as string}><CardHeader><Icon className="mb-2 size-5 text-primary" /><CardTitle className="text-base">{title as string}</CardTitle><CardDescription>{description as string}</CardDescription></CardHeader><CardContent><Badge variant="outline">Preview only</Badge></CardContent></Card>)}</div></div>;
}
