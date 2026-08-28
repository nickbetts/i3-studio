import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 rounded-lg text-xs",
  md: "size-9 rounded-lg text-sm",
  lg: "size-14 rounded-2xl text-xl",
};

export function BrandMark({ label = "i3", size = "md", className }: { label?: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-linear-to-br from-primary to-violet-400 font-bold tracking-tight text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-inset ring-white/15",
        sizes[size],
        className,
      )}
    >
      {label}
    </div>
  );
}
