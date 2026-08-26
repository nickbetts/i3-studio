import type { ReactNode } from "react";
import { CalendarClock, FileCheck2, Image, LayoutDashboard, LifeBuoy, LineChart, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { requireAgencyUser } from "@/lib/auth-helpers";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const user = await requireAgencyUser();

  const navItems: NavItem[] = [
    { href: "/agency", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agency/clients", label: "Clients", icon: Users },
    { href: "/agency/files", label: "Files", icon: FileCheck2 },
    { href: "/agency/designs", label: "Designs", icon: Image },
    { href: "/agency/support", label: "Support", icon: LifeBuoy },
    { href: "/agency/reports", label: "Reports", icon: LineChart },
  ];
  if (user.role === "admin") {
    navItems.push({ href: "/agency/calendar", label: "Calendar", icon: CalendarClock });
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
