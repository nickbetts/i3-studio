"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { NavItem } from "@/components/sidebar-nav";

export function WorkspaceSwitcher({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const matches = items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }
  return (
    <>
      <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground" aria-keyshortcuts="Meta+K Control+K" onClick={() => setOpen(true)}><Search className="size-4" />Go to page</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Go to page</DialogTitle></DialogHeader>
          <Input aria-label="Find a page" autoFocus placeholder="Find a page..." value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) navigate(matches[0].href); }} />
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {matches.map((item) => <Button key={item.href} variant="ghost" className="w-full justify-between" onClick={() => navigate(item.href)}><span>{item.label}</span><ArrowUpRight className="size-4 text-muted-foreground" /></Button>)}
            {!matches.length ? <p className="py-6 text-center text-sm text-muted-foreground">No matching pages</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
