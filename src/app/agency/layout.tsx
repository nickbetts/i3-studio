import type { ReactNode } from "react";
import { CalendarClock, LayoutDashboard, LifeBuoy, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { requireAgencyUser } from "@/lib/auth-helpers";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const user = await requireAgencyUser();

  const navItems: NavItem[] = [
    { href: "/agency", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agency/clients", label: "Clients", icon: Users },
    { href: "/agency/support", label: "Support", icon: LifeBuoy },
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
