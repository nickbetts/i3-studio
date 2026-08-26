import { Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { startPreview, stopPreview } from "@/app/agency/preview/actions";

export type PreviewTarget = { id: string; label: string; destination: string };

export function PreviewMenu({ targets }: { targets: PreviewTarget[] }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Eye className="size-4" />Preview as</Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-64"><DropdownMenuLabel>Choose a user</DropdownMenuLabel><DropdownMenuSeparator />{targets.map((target) => <form action={startPreview} key={target.id}><input type="hidden" name="targetId" value={target.id} /><input type="hidden" name="destination" value={target.destination} /><button type="submit" className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted">{target.label}</button></form>)}</DropdownMenuContent></DropdownMenu>;
}

export function PreviewReturn() {
  return <form action={stopPreview} className="fixed bottom-5 right-5 z-50"><Button type="submit" className="gap-2 shadow-lg"><RotateCcw className="size-4" />Return to admin</Button></form>;
}
