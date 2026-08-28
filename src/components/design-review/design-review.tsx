"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, MessageCircle } from "lucide-react";
import { addAnnotationComment, createAnnotation, resolveAnnotation } from "./actions";

export type DesignAnnotation = { id: string; x: number; y: number; resolved: boolean; comments: { id: string; body: string; authorUserId?: string | null }[] };

export function DesignReview({ designId, imageUrl, title, annotations }: { designId: string; imageUrl: string; title: string; annotations: DesignAnnotation[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function addPin(event: React.MouseEvent<HTMLDivElement>) {
    if (selected) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const body = window.prompt("Add a comment for this pin");
    if (!body?.trim()) return;
    startTransition(async () => {
      await createAnnotation(designId, x, y, body);
      toast.success("Comment added");
    });
  }

  function comment(annotationId: string) {
    const body = inputRef.current?.value ?? "";
    if (!body.trim()) return;
    startTransition(async () => {
      await addAnnotationComment(annotationId, body);
      if (inputRef.current) inputRef.current.value = "";
      toast.success("Reply added");
    });
  }

  return (
    <div className="grid gap-0 overflow-hidden rounded-lg border xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Canvas */}
      <div className="relative flex max-h-[75vh] items-center justify-center overflow-auto bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] bg-size-[16px_16px] p-6">
        <div onClick={addPin} className="relative inline-block cursor-crosshair shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={title} className="block max-h-[65vh] w-auto max-w-full select-none rounded-sm" draggable={false} />
          {annotations.map((annotation, index) => (
            <button
              type="button"
              key={annotation.id}
              aria-label={`Pin ${index + 1}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelected(annotation.id);
              }}
              className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-lg transition-transform hover:scale-110 ${
                selected === annotation.id ? "z-10 scale-110 ring-2 ring-primary ring-offset-2" : ""
              } ${annotation.resolved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"}`}
              style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%` }}
            >
              {annotation.resolved ? <Check className="size-3.5" /> : index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Comments sidebar */}
      <div className="flex max-h-[75vh] flex-col border-t bg-muted/20 xl:border-l xl:border-t-0">
        <div className="flex items-center gap-2 border-b bg-background/60 px-4 py-3">
          <MessageCircle className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">{annotations.length} comment{annotations.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {annotations.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Click anywhere on the design to leave the first comment.</p>
          ) : (
            annotations.map((annotation, index) => (
              <div
                key={annotation.id}
                onClick={() => setSelected(annotation.id)}
                className={`cursor-pointer rounded-md border p-3 transition-colors ${selected === annotation.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${annotation.resolved ? "bg-emerald-500" : "bg-primary"}`}>{index + 1}</span>
                    Pin {index + 1}
                  </span>
                  <Badge variant={annotation.resolved ? "secondary" : "outline"}>{annotation.resolved ? "Resolved" : "Open"}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  {annotation.comments.map((commentItem) => (
                    <p key={commentItem.id} className="rounded bg-muted p-2">{commentItem.body}</p>
                  ))}
                </div>
                {selected === annotation.id ? (
                  <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
                    <Input ref={inputRef} placeholder="Reply to this pin" onKeyDown={(event) => event.key === "Enter" && comment(annotation.id)} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={pending} onClick={() => comment(annotation.id)}>Reply</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => startTransition(async () => { await resolveAnnotation(annotation.id); toast.success("Pin updated"); })}
                      >
                        {annotation.resolved ? "Reopen" : "Mark resolved"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
