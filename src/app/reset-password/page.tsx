import { RecoveryForm } from "@/app/login/recovery-form";
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <RecoveryForm token={(await searchParams).token ?? ""} />;
}