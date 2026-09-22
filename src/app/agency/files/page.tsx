import { desc } from "drizzle-orm";
import Link from "next/link";
import { format } from "date-fns";
import { Download, File as FileIcon, FileArchive, FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SearchInput } from "@/components/search-input";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <CreatePanel title="Upload a file"><Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a file</CardTitle>
          <CardDescription>Word documents, PDFs and other client deliverables are stored securely.</CardDescription>
        </CardHeader>
        <CardContent><UploadForm action={uploadDocument} clients={clients} kind="document" submitLabel="Upload for approval" /></CardContent>
      </Card></CreatePanel>
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
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((file) => {
                    const Icon = fileIcon(file.fileName, file.contentType);
                    return (
                      <TableRow key={file.id}>
                        <TableCell className="max-w-72 whitespace-normal">
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{file.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{file.fileName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{clientName(file.clientAccountId)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatBytes(file.size)}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(file.createdAt), "d MMM yyyy")}</TableCell>
                        <TableCell><StatusBadge status={file.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/api/files/document/${file.id}`}><Download className="size-4" />Download</a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination page={currentPage} totalPages={totalPages} />
        </CardContent>
      </Card>
    </div>
  );
}
