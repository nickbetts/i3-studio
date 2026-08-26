import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { requireAgencyUser } from "@/lib/auth-helpers";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const user = await requireAgencyUser();

  const navItems: NavItem[] = [
    { href: "/agency", label: "Dashboard", icon: "dashboard" },
    { href: "/agency/clients", label: "Clients", icon: "clients" },
    { href: "/agency/projects", label: "Projects", icon: "projects" },
    { href: "/agency/files", label: "Files", icon: "files" },
    { href: "/agency/designs", label: "Designs", icon: "designs" },
    { href: "/agency/support", label: "Support", icon: "support" },
    { href: "/agency/reports", label: "Reports", icon: "reports" },
  ];
  if (user.role === "admin") {
    navItems.push({ href: "/agency/calendar", label: "Calendar", icon: "calendar" });
  }

  return (
    <AppShell
      brand="i3 Studio"
      roleLabel={user.role === "admin" ? "Admin" : "Account Manager"}
      navItems={navItems}
      user={{ name: user.name, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
