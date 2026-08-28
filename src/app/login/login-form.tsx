"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [show, setShow] = useState(false);

  return (
    <div className="relative z-10 w-full max-w-sm">
      <div className="mb-7 flex flex-col items-center text-center">
        <BrandMark size="lg" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your i3 Studio workspace</p>
      </div>
      <Card className="border-border/60 bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <CardContent className="pt-6">
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="mailto:support@i3studio.com?subject=Password%20reset" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Forgot password?</a>
              </div>
              <div className="relative">
                <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-10" />
                <button type="button" onClick={() => setShow((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} i3 Studio</p>
    </div>
  );
}
