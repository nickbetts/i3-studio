import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Crumb = { label: string; href?: string };

export function PageHeader({ title, description, actions, breadcrumbs }: { title: string; description?: string; actions?: ReactNode; breadcrumbs?: Crumb[] }) {
  return (
    <div className="space-y-2">
      {breadcrumbs?.length ? (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3" /> : null}
              {crumb.href ? <Link href={crumb.href} className="transition-colors hover:text-foreground">{crumb.label}</Link> : <span className="text-foreground">{crumb.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
