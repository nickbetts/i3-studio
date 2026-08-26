import type { ReactNode } from "react";
import { requireClientUser } from "@/lib/auth-helpers";

// Guards the whole portal area to authenticated client users.
export default async function PortalLayout({ children }: { children: ReactNode }) {
  await requireClientUser();
  return <>{children}</>;
}
