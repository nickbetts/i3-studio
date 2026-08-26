import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";

type AppShellProps = {
  brand: string;
  navItems: NavItem[];
  user: { name?: string | null; email?: string | null };
  roleLabel: string;
  children: ReactNode;
};

function initials(nameOrEmail: string) {
  const base = nameOrEmail.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function AppShell({ brand, navItems, user, roleLabel, children }: AppShellProps) {
  const display = user.name || user.email || "User";

  return (
    <div className="flex flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="text-lg font-semibold">{brand}</div>
          <div className="text-xs text-muted-foreground">{roleLabel}</div>
        </div>
        <SidebarNav items={navItems} />
        <div className="mt-auto space-y-2 border-t pt-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="size-8">
              <AvatarFallback>{initials(display)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{display}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-muted/20">
        <div className="mx-auto w-full max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
