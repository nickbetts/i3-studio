import { signOutAction } from "@/app/(auth)/sign-out";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
        <LogOut className="size-4" />
        Sign out
      </Button>
    </form>
  );
}
