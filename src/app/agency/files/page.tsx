import { desc } from "drizzle-orm";
import Link from "next/link";
import { format } from "date-fns";
import { Download, File as FileIcon, FileArchive, FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SearchInput } from "@/components/search-input";
import { Pagination } from "@/components/pagination";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { clientAccounts, documents } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDocument } from "./actions";

const PAGE_SIZE = 10;

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

export default async function AgencyFilesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requireAgencyUser();
  const { q, status, page } = await searchParams;
  const [clients, files] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }),
    db.query.documents.findMany({ orderBy: desc(documents.createdAt) }),
  ]);
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? "Unknown client";
  const query = (q ?? "").toLowerCase();
  const filtered = files.filter(
    (file) => (!status || file.status === status) && (!query || file.title.toLowerCase().includes(query) || file.fileName.toLowerCase().includes(query) || clientName(file.clientAccountId).toLowerCase().includes(query)),
  );
  const currentPage = Math.max(1, Number(page) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const statuses: [string, string][] = [["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["changes_requested", "Changes"]];
  const filterHref = (value: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (value) sp.set("status", value);
    const search = sp.toString();
    return `/agency/files${search ? `?${search}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Files & approvals" description="Share documents with clients for review." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a file</CardTitle>
          <CardDescription>Word documents, PDFs and other client deliverables are stored securely.</CardDescription>
        </CardHeader>
        <CardContent><UploadForm action={uploadDocument} clients={clients} kind="document" submitLabel="Upload for approval" /></CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Shared files</CardTitle>
            <SearchInput placeholder="Search files…" />
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map(([value, label]) => (
              <Button key={value || "all"} size="sm" variant={(status ?? "") === value ? "default" : "outline"} asChild>
                <Link href={filterHref(value)}>{label}</Link>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {pageItems.length === 0 ? (
            <EmptyState icon={FileText} title="No files found" description={query || status ? "Try adjusting your search or filters." : "Upload a file above to share it with a client."} />
          ) : (
            <div className="divide-y divide-border/60">
              {pageItems.map((file) => {
                const Icon = fileIcon(file.fileName, file.contentType);
                return (
                  <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{file.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{clientName(file.clientAccountId)} · {file.fileName} · {formatBytes(file.size)} · {format(new Date(file.createdAt), "d MMM yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={file.status} />
                      <Button size="sm" variant="ghost" asChild>
                        <a href={file.fileUrl} target="_blank" rel="noreferrer"><Download className="size-4" />Download</a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={currentPage} totalPages={totalPages} />
        </CardContent>
      </Card>
    </div>
  );
}
