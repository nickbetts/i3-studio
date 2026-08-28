"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Variant = "destructive" | "outline" | "default" | "ghost" | "secondary";

export function ConfirmButton({
  action,
  hidden,
  label,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  size = "sm",
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  label: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: Variant;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <form action={action}>
              {hidden ? Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />) : null}
              <Button type="submit" variant={variant}>{confirmLabel}</Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
