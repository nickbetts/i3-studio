"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, FileCheck2, FilePenLine, FolderKanban, Image, LayoutDashboard, LifeBuoy, LineChart, Paperclip, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: "calendar" | "files" | "projects" | "designs" | "dashboard" | "support" | "reports" | "clients" | "settings" | "reference" | "content";
};

const icons = { calendar: CalendarClock, files: FileCheck2, projects: FolderKanban, designs: Image, dashboard: LayoutDashboard, support: LifeBuoy, reports: LineChart, clients: Users, settings: Settings, reference: Paperclip, content: FilePenLine };

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
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {active ? <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary" /> : null}
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
