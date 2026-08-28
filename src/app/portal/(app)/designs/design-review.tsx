"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAnnotationComment, createAnnotation, resolveAnnotation } from "./actions";

type Annotation = { id: string; x: number; y: number; resolved: boolean; comments: { id: string; body: string }[] };

export function DesignReview({ designId, imageUrl, title, annotations }: { designId: string; imageUrl: string; title: string; annotations: Annotation[] }) {
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
    startTransition(async () => { await createAnnotation(designId, x, y, body); toast.success("Comment added"); });
  }
  function comment(annotationId: string) {
    const body = inputRef.current?.value ?? "";
    if (!body.trim()) return;
    startTransition(async () => { await addAnnotationComment(annotationId, body); if (inputRef.current) inputRef.current.value = ""; toast.success("Reply added"); });
  }
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div onClick={addPin} className="relative cursor-crosshair overflow-hidden rounded-md border bg-muted"><img src={imageUrl} alt={title} className="block h-auto w-full" />{/* eslint-disable-line @next/next/no-img-element */}{annotations.map((annotation, index) => <button type="button" key={annotation.id} aria-label={`Pin ${index + 1}`} onClick={(event) => { event.stopPropagation(); setSelected(annotation.id); }} className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow ${annotation.resolved ? "bg-muted-foreground text-white" : "bg-primary text-primary-foreground"}`} style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%` }}>{index + 1}</button>)}</div><div className="space-y-3">{annotations.length === 0 ? <p className="text-sm text-muted-foreground">Click the design to leave the first comment.</p> : annotations.map((annotation, index) => <div key={annotation.id} className={`rounded-md border p-3 ${selected === annotation.id ? "ring-2 ring-primary" : ""}`}><div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-medium">Pin {index + 1}</span><Badge variant={annotation.resolved ? "secondary" : "outline"}>{annotation.resolved ? "Resolved" : "Open"}</Badge></div><div className="space-y-2 text-sm">{annotation.comments.map((commentItem) => <p key={commentItem.id} className="rounded bg-muted p-2">{commentItem.body}</p>)}</div><div className="mt-3 space-y-2"><Input ref={selected === annotation.id ? inputRef : undefined} placeholder="Reply to this pin" /><div className="flex gap-2"><Button size="sm" disabled={pending} onClick={() => comment(annotation.id)}>Reply</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { await resolveAnnotation(annotation.id); toast.success("Pin updated"); })}>{annotation.resolved ? "Reopen" : "Resolve"}</Button></div></div></div>)}</div></div>;
}
