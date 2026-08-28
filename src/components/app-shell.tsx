import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "@/components/brand-mark";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { PreviewMenu, PreviewReturn, type PreviewTarget } from "@/components/preview-menu";

type AppShellProps = {
  brand: string;
  navItems: NavItem[];
  user: { name?: string | null; email?: string | null };
  roleLabel: string;
  children: ReactNode;
  preview?: boolean;
  previewTargets?: PreviewTarget[];
  previewing?: boolean;
};

function initials(nameOrEmail: string) {
  const base = nameOrEmail.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function SidebarBody({ brand, roleLabel, navItems, user, preview, previewTargets }: Omit<AppShellProps, "children" | "previewing">) {
  const display = user.name || user.email || "User";
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-5">
        <BrandMark />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-none">{brand}</div>
          <div className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{roleLabel}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Menu</p>
        <SidebarNav items={navItems} />
      </div>
      <div className="space-y-2 border-t border-border/60 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <Avatar className="size-8 ring-1 ring-border">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(display)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{display}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
        {preview ? <PreviewMenu targets={previewTargets ?? []} /> : null}
        <SignOutButton />
      </div>
    </div>
  );
}

export function AppShell({ brand, navItems, user, roleLabel, children, preview = false, previewTargets = [], previewing = false }: AppShellProps) {
  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/70 backdrop-blur-xl md:flex">
        <SidebarBody brand={brand} roleLabel={roleLabel} navItems={navItems} user={user} preview={preview} previewTargets={previewTargets} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:hidden">
          <Sheet>
            <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Menu className="size-4" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-border/60 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody brand={brand} roleLabel={roleLabel} navItems={navItems} user={user} preview={preview} previewTargets={previewTargets} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span className="truncate text-sm font-semibold">{brand}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {previewing ? <PreviewReturn /> : null}
    </div>
  );
}
