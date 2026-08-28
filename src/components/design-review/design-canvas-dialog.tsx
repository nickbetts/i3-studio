"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { DesignReview, type DesignAnnotation } from "./design-review";

export function DesignCanvasDialog({
  designId,
  imageUrl,
  title,
  status,
  subtitle,
  annotations,
}: {
  designId: string;
  imageUrl: string;
  title: string;
  status: string;
  subtitle?: string;
  annotations: DesignAnnotation[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full overflow-hidden rounded-md border text-left transition-colors hover:border-primary/40"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <Image src={imageUrl} alt={title} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
          {annotations.length > 0 ? (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              <MessageSquare className="size-3" />
              {annotations.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <StatusBadge status={status} />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl p-0 sm:max-w-6xl">
          <DialogHeader className="flex-row items-center justify-between gap-3 border-b p-4 pr-12">
            <div className="min-w-0">
              <DialogTitle className="truncate">{title}</DialogTitle>
              {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="capitalize">{status.replace(/_/g, " ")}</Badge>
              <Button size="sm" variant="ghost" asChild>
                <a href={imageUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open original</a>
              </Button>
            </div>
          </DialogHeader>
          <div className="p-4 pt-2">
            <DesignReview designId={designId} imageUrl={imageUrl} title={title} annotations={annotations} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
