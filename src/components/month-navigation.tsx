import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthWindow } from "@/lib/time-budget";

export function MonthNavigation({ period, path }: { period: ReturnType<typeof monthWindow>; path: string }) {
  return <nav aria-label="Report month" className="flex items-center gap-2"><Button asChild size="icon-sm" variant="outline"><Link href={`${path}?month=${period.previous}`} aria-label="Previous month" title="Previous month"><ChevronLeft className="size-4" /></Link></Button><span className="min-w-32 text-center text-sm font-medium">{period.label}</span><Button asChild size="icon-sm" variant="outline"><Link href={`${path}?month=${period.next}`} aria-label="Next month" title="Next month"><ChevronRight className="size-4" /></Link></Button></nav>;
}
