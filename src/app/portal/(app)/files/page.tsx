import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { Download, File as FileIcon, FileArchive, FileImage, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmButton } from "@/components/confirm-button";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { referenceFiles, users } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { deleteReference, uploadReference } from "./actions";

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function fileIcon(name: string, type: string | null) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if ((type ?? "").startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return FileImage;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return FileText;
  return FileIcon;
}

export default async function PortalFilesPage() {
  const user = await requireClientUser();
  const rows = await db
    .select({
      id: referenceFiles.id,
      title: referenceFiles.title,
      fileUrl: referenceFiles.fileUrl,
      fileName: referenceFiles.fileName,
      contentType: referenceFiles.contentType,
      size: referenceFiles.size,
      createdAt: referenceFiles.createdAt,
      uploadedByUserId: referenceFiles.uploadedByUserId,
      uploaderName: users.name,
      uploaderRole: users.role,
    })
    .from(referenceFiles)
    .leftJoin(users, eq(referenceFiles.uploadedByUserId, users.id))
    .where(eq(referenceFiles.clientAccountId, user.clientAccountId))
    .orderBy(desc(referenceFiles.createdAt));

  return (
    <div className="space-y-6">
      <PageHeader title="Files" description="Share reference material with your team. Anything you upload here is visible to you and i3 Studio." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a reference file</CardTitle>
          <CardDescription>Brand assets, briefs, examples — any file type up to 25MB.</CardDescription>
        </CardHeader>
        <CardContent><UploadForm action={uploadReference} fixedClientId={user.clientAccountId} kind="reference" submitLabel="Upload file" /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Shared reference files</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState icon={FileText} title="No files yet" description="Upload a reference file above to share it with your team." />
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((row) => {
                const Icon = fileIcon(row.fileName, row.contentType);
                const mine = row.uploadedByUserId === user.id;
                return (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.fileName} · {formatBytes(row.size)} · {format(new Date(row.createdAt), "d MMM yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{mine ? "You" : row.uploaderRole === "client" ? row.uploaderName || "Your team" : "i3 Studio"}</Badge>
                      <Button size="sm" variant="ghost" asChild><a href={row.fileUrl} target="_blank" rel="noreferrer"><Download className="size-4" />Download</a></Button>
                      {mine ? (
                        <ConfirmButton action={deleteReference} hidden={{ id: row.id }} label="Delete" title="Delete this file?" description="This removes the reference file for everyone." confirmLabel="Delete" variant="ghost" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
