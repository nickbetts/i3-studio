"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, FileCheck2, FolderKanban, Image, LayoutDashboard, LifeBuoy, LineChart, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: "calendar" | "files" | "projects" | "designs" | "dashboard" | "support" | "reports" | "clients" | "settings";
};

const icons = { calendar: CalendarClock, files: FileCheck2, projects: FolderKanban, designs: Image, dashboard: LayoutDashboard, support: LifeBuoy, reports: LineChart, clients: Users, settings: Settings };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = icons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
