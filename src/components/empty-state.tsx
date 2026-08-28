import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, action }: { icon?: ComponentType<LucideProps>; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
