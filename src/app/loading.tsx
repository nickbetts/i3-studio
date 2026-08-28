import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-6xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
