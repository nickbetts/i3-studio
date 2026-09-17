"use client";

import { useEffect, useState, useTransition } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prepareUpload } from "@/lib/upload-client";
import { addTaskComment, deleteTaskComment, getTaskDetail, updateTaskDetails, type TaskDetail } from "./actions";

export function TaskDetailDialog({ taskId, title, currentUserId, canEdit }: { taskId: string; title: string; currentUserId: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getTaskDetail(taskId).then((result) => {
      setDetail(result);
      setLoading(false);
    });
  }, [open, taskId]);

  function save() {
    if (!detail) return;
    start(async () => {
      await updateTaskDetails(taskId, { title: detail.title, description: detail.description ?? "", priority: detail.priority, dueDate: detail.dueDate ?? "" });
      toast.success("Task saved");
    });
  }

  function submitComment() {
    if (!comment.trim()) return;
    start(async () => {
      let attachmentForm: FormData | undefined;
      if (commentFile && detail) {
        const form = new FormData();
        form.set("file", commentFile);
        form.set("clientAccountId", detail.clientAccountId);
        try {
          attachmentForm = await prepareUpload(form, "task_attachment");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Attachment upload failed.");
          return;
        }
      }
      await addTaskComment(taskId, comment, attachmentForm);
      setComment("");
      setCommentFile(null);
      const refreshed = await getTaskDetail(taskId);
      setDetail(refreshed);
    });
  }

  return (
    <>
      <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setOpen(true)}>{title}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Task details</DialogTitle>
            <DialogDescription>View and update this task, and leave notes for the team.</DialogDescription>
          </DialogHeader>
          {loading || !detail ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={detail.title} disabled={!canEdit} onChange={(event) => setDetail({ ...detail, title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={detail.description ?? ""} disabled={!canEdit} onChange={(event) => setDetail({ ...detail, description: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={detail.priority} disabled={!canEdit} onValueChange={(value) => setDetail({ ...detail, priority: value as TaskDetail["priority"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="date" value={detail.dueDate ?? ""} disabled={!canEdit} onChange={(event) => setDetail({ ...detail, dueDate: event.target.value })} />
                </div>
              </div>
              {canEdit ? <Button size="sm" variant="outline" onClick={save} disabled={pending}>Save changes</Button> : null}

              <div className="space-y-3 border-t pt-4">
                <Label>Comments</Label>
                {detail.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.comments.map((item) => (
                      <div key={item.id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{item.authorName ?? "Unknown"}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                            {item.authorUserId === currentUserId || canEdit ? (
                              <form action={deleteTaskComment}>
                                <input type="hidden" name="commentId" value={item.id} />
                                <input type="hidden" name="taskId" value={taskId} />
                                <button type="submit" className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
                        {item.attachmentUrl ? <a href={`/api/files/task-comment/${item.id}`} className="mt-2 flex items-center gap-1 text-xs font-medium underline underline-offset-2"><Paperclip className="size-3" />{item.attachmentName ?? "Attachment"}</a> : null}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment…" rows={2} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Input type="file" className="max-w-56 text-xs" onChange={(event) => setCommentFile(event.target.files?.[0] ?? null)} />
                  <Button size="sm" onClick={submitComment} disabled={pending || !comment.trim()}>Add comment</Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
