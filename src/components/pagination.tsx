"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("page", String(target));
    return `${pathname}?${sp.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-2 pt-4">
      <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild><Link href={href(page - 1)}>Previous</Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Previous</Button>
        )}
        {page < totalPages ? (
          <Button variant="outline" size="sm" asChild><Link href={href(page + 1)}>Next</Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Next</Button>
        )}
      </div>
    </div>
  );
}
