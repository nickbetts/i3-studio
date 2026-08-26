import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FileCheck2, FolderKanban, LayoutDashboard, LifeBuoy, PenTool } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { db } from "@/db";
import { clientAccounts } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";

export default async function PortalAppLayout({ children }: { children: ReactNode }) {
  const user = await requireClientUser();

  const account = await db.query.clientAccounts.findFirst({
    where: eq(clientAccounts.id, user.clientAccountId),
  });

  // Force onboarding until the client has completed the wizard.
  if (!account?.onboardingCompletedAt) redirect("/portal/onboarding");

  const navItems: NavItem[] = [
    { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/projects", label: "Projects", icon: FolderKanban },
    { href: "/portal/approvals", label: "Approvals", icon: FileCheck2 },
    { href: "/portal/designs", label: "Designs", icon: PenTool },
    { href: "/portal/support", label: "Support", icon: LifeBuoy },
  ];

  return (
    <AppShell
      brand={account?.name ?? "Client Portal"}
      roleLabel="Client"
      navItems={navItems}
      user={{ name: user.name, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
