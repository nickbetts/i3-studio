"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TaskFilterSelect({ paramKey, placeholder, options }: { paramKey: string; placeholder: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? options[0]?.value ?? "";

  function onChange(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value && value !== options[0]?.value) sp.set(paramKey, value);
    else sp.delete(paramKey);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}
