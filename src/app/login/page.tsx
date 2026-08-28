import { redirect } from "next/navigation";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isAgencyRole(user.role) ? "/agency" : "/portal");

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[32rem] w-[32rem] rounded-full bg-chart-2/15 blur-[120px]" />
      <LoginForm />
    </div>
  );
}
