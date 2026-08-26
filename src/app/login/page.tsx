import { redirect } from "next/navigation";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isAgencyRole(user.role) ? "/agency" : "/portal");

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <LoginForm />
    </div>
  );
}
