"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateUserAvatar, type AvatarState } from "./actions";

function initials(value: string) {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function AvatarUpload({ userId, name, image, color }: { userId: string; name: string; image?: string | null; color: string }) {
  const [state, formAction] = useActionState<AvatarState, FormData>(updateUserAvatar, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <input ref={inputRef} type="file" name="file" accept="image/*" className="hidden" onChange={() => formRef.current?.requestSubmit()} />
      <button type="button" onClick={() => inputRef.current?.click()} className="group relative rounded-full ring-1 ring-border" title="Change photo">
        <Avatar className="size-10">
          {image ? <AvatarImage src={image} alt={name} /> : null}
          <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: color }}>{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Edit</span>
      </button>
    </form>
  );
}
