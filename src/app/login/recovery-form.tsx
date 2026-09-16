"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, resetPassword } from "./recovery-actions";

export function RecoveryForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState(token === undefined ? requestPasswordReset : resetPassword, {});
  return <main className="m-auto w-full max-w-md space-y-5 p-6">
    <h1 className="text-xl font-semibold">{token === undefined ? "Reset your password" : "Choose a new password"}</h1>
    <form action={action} className="space-y-4">
      {token === undefined ? <div className="space-y-2"><Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" name="email" type="email" autoComplete="email" required /></div> : <><input type="hidden" name="token" value={token} /><div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" name="password" type="password" minLength={12} maxLength={72} autoComplete="new-password" required /></div></>}
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p role="status" className="text-sm">{state.message}</p> : null}
      <Button disabled={pending}>{pending ? "Please wait..." : token === undefined ? "Send reset link" : "Update password"}</Button>
    </form>
    <Link href="/login" className="block text-sm underline">Back to sign in</Link>
  </main>;
}