"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type UploadState = { error?: string; success?: string };
type Client = { id: string; name: string };

export function UploadForm({
  action,
  clients,
  fixedClientId,
  kind = "document",
  submitLabel,
}: {
  action: (state: UploadState, formData: FormData) => Promise<UploadState>;
  clients?: Client[];
  fixedClientId?: string;
  kind?: "document" | "design" | "reference";
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileName(null);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
      {fixedClientId ? (
        <input type="hidden" name="clientAccountId" value={fixedClientId} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="uf-client">Client</Label>
          <Select name="clientAccountId" required>
            <SelectTrigger id="uf-client"><SelectValue placeholder="Choose a client" /></SelectTrigger>
            <SelectContent>{(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="uf-title">Title</Label>
        <Input id="uf-title" name="title" required />
      </div>
      {kind === "document" ? (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="uf-description">Description</Label>
          <Textarea id="uf-description" name="description" />
        </div>
      ) : null}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="uf-file">{kind === "design" ? "Screenshot" : "File"}</Label>
        <Input
          id="uf-file"
          name="file"
          type="file"
          accept={kind === "design" ? "image/*" : undefined}
          required
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
        <p className="text-xs text-muted-foreground">{fileName ? `Selected: ${fileName}` : "Maximum size 25MB."}</p>
      </div>
      {state.error ? <p className="text-sm text-destructive md:col-span-2">{state.error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Uploading…" : submitLabel ?? "Upload"}</Button>
      </div>
    </form>
  );
}
