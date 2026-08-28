import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">The page you’re looking for doesn’t exist or has moved.</p>
      </div>
      <Button asChild><Link href="/">Back to home</Link></Button>
    </div>
  );
}
