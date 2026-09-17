"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prepareUpload } from "@/lib/upload-client";
import { createTicket } from "./actions";
export function NewTicketForm({ clientAccountId }: { clientAccountId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const file = formData.get("file");
      const prepared = file instanceof File && file.size > 0 ? await prepareUpload(formData, "ticket_attachment") : formData;
      await createTicket(prepared);
      formRef.current?.reset();
      setFileName(null);
      toast.success("Ticket opened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open ticket. Please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-4">
        <input type="hidden" name="clientAccountId" value={clientAccountId} />
      <div className="space-y-2">
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input id="ticket-subject" name="subject" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-priority">Priority</Label>
        <Select name="priority" defaultValue="medium">
          <SelectTrigger id="ticket-priority" aria-label="Priority"><SelectValue /></SelectTrigger>
          <SelectContent>{["low", "medium", "high", "urgent"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-body">Message</Label>
        <Textarea id="ticket-body" name="body" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-file">Attachment (optional)</Label>
        <Input id="ticket-file" name="file" type="file" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)} />
        {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Opening…" : "Open ticket"}</Button>
    </form>
  );
}
