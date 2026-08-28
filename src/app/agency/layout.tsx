import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { db } from "@/db";
import { contentItems, designAssets, documents, tickets, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { isPreviewing } from "@/lib/auth-helpers";
import { and, count, eq, inArray } from "drizzle-orm";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const user = await requireAgencyUser();
  const previewing = await isPreviewing();
  const record = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  const permissions = record?.permissions as { tabs?: unknown } | null;
  const allowedTabs = user.role === "admin" || !Array.isArray(permissions?.tabs) ? null : permissions.tabs;
  const previewUsers = user.role === "admin" && !previewing ? await db.query.users.findMany({ where: (row, { inArray }) => inArray(row.role, ["admin", "account_manager", "content_writer", "client"]) }) : [];
  const previewTargets = previewUsers.map((target) => ({ id: target.id, label: `${target.name || target.email} (${target.role})`, destination: target.role === "client" ? "/portal" : "/agency" }));

  const [[pendingFiles], [pendingDesigns], [openTickets], [pendingContent]] = await Promise.all([
    db.select({ value: count() }).from(documents).where(eq(documents.status, "pending")),
    db.select({ value: count() }).from(designAssets).where(eq(designAssets.status, "pending")),
    db.select({ value: count() }).from(tickets).where(inArray(tickets.status, ["open", "pending"])),
    user.role === "content_writer"
      ? db.select({ value: count() }).from(contentItems).where(and(eq(contentItems.assignedToUserId, user.id), inArray(contentItems.status, ["am_changes", "client_changes"])))
      : db.select({ value: count() }).from(contentItems).where(eq(contentItems.status, "pending_am")),
  ]);

  const navItems: NavItem[] = [
    { href: "/agency", label: "Dashboard", icon: "dashboard" },
    { href: "/agency/clients", label: "Clients", icon: "clients" },
    { href: "/agency/projects", label: "Projects", icon: "projects" },
    { href: "/agency/content", label: "Content", icon: "content", count: pendingContent?.value ?? 0 },
    { href: "/agency/files", label: "Files", icon: "files", count: pendingFiles?.value ?? 0 },
    { href: "/agency/designs", label: "Designs", icon: "designs", count: pendingDesigns?.value ?? 0 },
    { href: "/agency/support", label: "Support", icon: "support", count: openTickets?.value ?? 0 },
    { href: "/agency/reports", label: "Reports", icon: "reports" },
    { href: "/agency/settings", label: "Settings", icon: "settings" },
  ];
  const visibleItems = allowedTabs ? navItems.filter((item) => allowedTabs.includes(item.icon)) : navItems;
  visibleItems.push({ href: "/agency/calendar", label: "Calendar", icon: "calendar" });

  return (
    <AppShell
      brand="i3 Studio"
      roleLabel={user.role === "admin" ? "Admin" : user.role === "content_writer" ? "Content Writer" : "Account Manager"}
      navItems={visibleItems}
      preview={user.role === "admin"}
      previewTargets={previewTargets}
      previewing={previewing}
      user={{ name: user.name, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
