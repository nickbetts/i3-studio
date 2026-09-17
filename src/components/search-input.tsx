"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({ placeholder = "Search…", paramKey = "q" }: { placeholder?: string; paramKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlValue = params.get(paramKey) ?? "";
  const [value, setValue] = useState(urlValue);
  const [previousUrlValue, setPreviousUrlValue] = useState(urlValue);
  if (urlValue !== previousUrlValue) {
    setPreviousUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    if (value === urlValue) return;
    const timeout = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (value) sp.set(paramKey, value);
      else sp.delete(paramKey);
      sp.delete("page");
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, urlValue, params, pathname, router, paramKey]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label={placeholder.replace(/[….]+$/, "")} type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}
