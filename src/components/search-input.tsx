"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({ placeholder = "Search…", paramKey = "q" }: { placeholder?: string; paramKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramKey) ?? "");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (value) sp.set(paramKey, value);
      else sp.delete(paramKey);
      sp.delete("page");
      router.replace(`${pathname}?${sp.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}
