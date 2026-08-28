import type { ReactNode } from "react";
import { and, eq, inArray, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { db } from "@/db";
import { clientAccounts, contentItems, designAssets, documents, tickets } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { isPreviewing } from "@/lib/auth-helpers";

export default async function PortalAppLayout({ children }: { children: ReactNode }) {
  const user = await requireClientUser();
  const previewing = await isPreviewing();

  const account = await db.query.clientAccounts.findFirst({
    where: eq(clientAccounts.id, user.clientAccountId),
  });

  // Force onboarding until the client has completed the wizard.
  if (!account?.onboardingCompletedAt) redirect("/portal/onboarding");

  const [[pendingFiles], [pendingDesigns], [pendingContent], [openTickets]] = await Promise.all([
    db.select({ value: count() }).from(documents).where(and(eq(documents.clientAccountId, user.clientAccountId), eq(documents.status, "pending"))),
    db.select({ value: count() }).from(designAssets).where(and(eq(designAssets.clientAccountId, user.clientAccountId), eq(designAssets.status, "pending"))),
    db.select({ value: count() }).from(contentItems).where(and(eq(contentItems.clientAccountId, user.clientAccountId), eq(contentItems.status, "pending_client"))),
    db.select({ value: count() }).from(tickets).where(and(eq(tickets.clientAccountId, user.clientAccountId), inArray(tickets.status, ["open", "pending"]))),
  ]);
  const approvalsCount = (pendingFiles?.value ?? 0) + (pendingDesigns?.value ?? 0) + (pendingContent?.value ?? 0);

  const navItems: NavItem[] = [
    { href: "/portal", label: "Dashboard", icon: "dashboard" },
    { href: "/portal/projects", label: "Projects", icon: "projects" },
    { href: "/portal/approvals", label: "Approvals", icon: "files", count: approvalsCount },
    { href: "/portal/support", label: "Support", icon: "support", count: openTickets?.value ?? 0 },
  ];
  const visibleTabs = Array.isArray(account?.visibleTabs) ? account.visibleTabs : navItems.map((item) => item.icon);
  const visibleItems = navItems.filter((item) => visibleTabs.includes(item.icon));
  visibleItems.push({ href: "/portal/files", label: "Files", icon: "reference" });

  return (
    <AppShell
      brand={account?.name ?? "Client Portal"}
      roleLabel="Client"
      navItems={visibleItems}
      user={{ name: user.name, email: user.email }}
      previewing={previewing}
    >
      {children}
    </AppShell>
  );
}
