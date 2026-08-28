"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, History, MessageSquare, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { DesignReview, type DesignAnnotation } from "./design-review";
import { uploadDesignVersion, type UploadVersionState } from "./actions";

export type DesignVersion = { version: number; imageUrl: string; status: string; createdAt: string | Date };

export function DesignCanvasDialog({
  designId,
  imageUrl,
  title,
  status,
  subtitle,
  annotations,
  versions,
  canUploadVersion = false,
  canDelete = false,
}: {
  designId: string;
  imageUrl: string;
  title: string;
  status: string;
  subtitle?: string;
  annotations: DesignAnnotation[];
  versions: DesignVersion[];
  canUploadVersion?: boolean;
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const latest = sorted[0];
  const [viewingVersion, setViewingVersion] = useState(latest?.version ?? 1);
  const viewing = sorted.find((v) => v.version === viewingVersion) ?? latest;
  const isLatest = viewing?.version === latest?.version;

  const [uploadState, uploadAction, uploadPending] = useActionState<UploadVersionState, FormData>(uploadDesignVersion, {});
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (uploadState.success) toast.success(uploadState.success);
    else if (uploadState.error) toast.error(uploadState.error);
  }, [uploadState]);

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
          {versions.length > 1 ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              <History className="size-3" />
              v{latest?.version}
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
              {sorted.length > 1 ? (
                <Select value={String(viewingVersion)} onValueChange={(value) => setViewingVersion(Number(value))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sorted.map((v) => (
                      <SelectItem key={v.version} value={String(v.version)}>
                        v{v.version}{v.version === latest.version ? " (latest)" : ""} · {format(new Date(v.createdAt), "d MMM")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Badge variant="outline" className="capitalize">{status.replace(/_/g, " ")}</Badge>
              <Button size="sm" variant="ghost" asChild>
                <a href={viewing?.imageUrl ?? imageUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open</a>
              </Button>
              {canUploadVersion ? (
                <form ref={formRef} action={uploadAction}>
                  <input type="hidden" name="designAssetId" value={designId} />
                  <input ref={fileRef} type="file" name="file" accept="image/*" className="hidden" onChange={() => formRef.current?.requestSubmit()} />
                  <Button type="button" size="sm" variant="outline" disabled={uploadPending} onClick={() => fileRef.current?.click()}>
                    <Upload className="size-4" />
                    {uploadPending ? "Uploading…" : "New version"}
                  </Button>
                </form>
              ) : null}
            </div>
          </DialogHeader>

          {isLatest ? (
            <div className="p-4 pt-2">
              <DesignReview designId={designId} imageUrl={viewing?.imageUrl ?? imageUrl} title={title} annotations={annotations} canDelete={canDelete} />
            </div>
          ) : (
            <div className="space-y-3 p-4 pt-2">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                Viewing version {viewing?.version} from {viewing ? format(new Date(viewing.createdAt), "d MMM yyyy") : ""}. Comments can only be added on the latest version — switch above to comment.
              </div>
              <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] bg-size-[16px_16px] p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewing?.imageUrl} alt={`${title} — version ${viewing?.version}`} className="block max-h-[60vh] w-auto max-w-full rounded-sm shadow-2xl" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
