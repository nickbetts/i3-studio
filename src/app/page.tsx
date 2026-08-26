import { redirect } from "next/navigation";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(isAgencyRole(user.role) ? "/agency" : "/portal");
}
