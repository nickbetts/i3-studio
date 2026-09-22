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
import { MentionInput } from "@/components/mention-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prepareUpload } from "@/lib/upload-client";
import { formatLoggedTime } from "@/lib/time-format";
import { serviceAllocation } from "@/lib/service-allocations";
import { addTaskComment, addTaskDependency, createSubtask, deleteTaskComment, getTaskDetail, updateChecklist, updateTaskDetails, type TaskDetail } from "./actions";

export function TaskDetailDialog({ taskId, title, currentUserId, canEdit, team = [] }: { taskId: string; title: string; currentUserId: string; canEdit: boolean; team?: { id: string; name: string | null; email: string }[] }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [checklistLabel, setChecklistLabel] = useState("");
  const [dependencyId, setDependencyId] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getTaskDetail(taskId).then((result) => {
      setDetail(result);
      setLoading(false);
    }).catch(() => { setLoading(false); toast.error("Could not load the task. Please reopen it to retry."); });
  }, [open, taskId]);

  function save() {
    if (!detail) return;
    start(async () => {
      await updateTaskDetails(taskId, { title: detail.title, description: detail.description ?? "", priority: detail.priority, dueDate: detail.dueDate ?? "", recurrenceRule: detail.recurrenceRule });
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

  function activityText(item: TaskDetail["activities"][number]) {
    if (item.action === "time_logged") {
      const seconds = typeof item.metadata?.durationSeconds === "number" ? item.metadata.durationSeconds : 0;
      const service = typeof item.metadata?.serviceType === "string" ? serviceAllocation(item.metadata.serviceType).label : "task work";
      return `logged ${formatLoggedTime(seconds)} to ${service}`;
    }
    if (item.action === "priority_changed") return `changed priority to ${String(item.metadata?.to ?? "unknown")}`;
    if (item.action === "due_date_changed") return item.metadata?.to ? `changed due date to ${new Date(String(item.metadata.to)).toLocaleDateString("en-GB")}` : "cleared the due date";
    return item.action.replaceAll("_", " ");
  }

  return (
    <>
      <button type="button" title={title} className="block max-w-full truncate text-left font-medium underline-offset-4 hover:underline" onClick={() => setOpen(true)}>{title}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{canEdit ? "Task workspace" : "Read-only task"}</DialogDescription>
          </DialogHeader>
          {loading || !detail ? (
            <p className="text-sm text-muted-foreground">{loading ? "Loading task..." : "Task unavailable. Close and retry."}</p>
          ) : (
            <Tabs defaultValue="details" className="min-w-0">
              <TabsList className="mb-3 w-full"><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="comments">Comments ({detail.comments.length})</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
              <TabsContent value="details" className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input aria-label="Task title" value={detail.title} disabled={!canEdit} onChange={(event) => setDetail({ ...detail, title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea aria-label="Task description" value={detail.description ?? ""} disabled={!canEdit} onChange={(event) => setDetail({ ...detail, description: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={detail.priority} disabled={!canEdit} onValueChange={(value) => setDetail({ ...detail, priority: value as TaskDetail["priority"] })}>
                    <SelectTrigger aria-label="Task priority"><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input aria-label="Task due date" type="date" value={detail.dueDate ?? ""} disabled={!canEdit} onChange={(event) => setDetail({ ...detail, dueDate: event.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Repeat</Label>
                  <Select value={detail.recurrenceRule ?? "none"} disabled={!canEdit} onValueChange={(value) => setDetail({ ...detail, recurrenceRule: value === "none" ? null : value as TaskDetail["recurrenceRule"] })}>
                    <SelectTrigger aria-label="Repeat task"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Does not repeat</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              {canEdit ? <Button size="sm" onClick={save} disabled={pending}>Save changes</Button> : null}

              <div className="space-y-2 border-t pt-4">
                <Label>Checklist</Label>
                <p className="text-xs text-muted-foreground">{detail.checklist.filter((item) => item.done).length} of {detail.checklist.length} complete</p>
                {detail.checklist.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit || pending} checked={item.done} onChange={(event) => { const checklist = detail.checklist.map((entry) => entry.id === item.id ? { ...entry, done: event.target.checked } : entry); start(async () => { await updateChecklist(taskId, checklist); setDetail({ ...detail, checklist }); }); }} /> <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span></label>)}
                {canEdit ? <div className="flex gap-2"><Input aria-label="Checklist item" value={checklistLabel} onChange={(event) => setChecklistLabel(event.target.value)} placeholder="Add checklist item" /><Button size="sm" variant="outline" disabled={pending || !checklistLabel.trim()} onClick={() => { const checklist = [...detail.checklist, { id: crypto.randomUUID(), label: checklistLabel.trim(), done: false }]; start(async () => { await updateChecklist(taskId, checklist); setDetail({ ...detail, checklist }); setChecklistLabel(""); }); }}>Add</Button></div> : null}
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Subtasks</Label>
                {detail.subtasks.map((item) => <p key={item.id} className="text-sm">{item.title} <span className="text-xs capitalize text-muted-foreground">({item.status.replace("_", " ")})</span></p>)}
                {canEdit ? <div className="flex gap-2"><Input aria-label="Subtask title" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add subtask" /><Button size="sm" variant="outline" disabled={pending || !subtaskTitle.trim()} onClick={() => start(async () => { await createSubtask(taskId, subtaskTitle); setSubtaskTitle(""); setDetail(await getTaskDetail(taskId)); })}>Add</Button></div> : null}
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Dependencies</Label>
                {detail.dependencies.map((item) => <p key={item.id} className="text-sm">Blocked by: {item.title} <span className="text-xs capitalize text-muted-foreground">({item.status.replace("_", " ")})</span></p>)}
                {canEdit ? <div className="flex gap-2"><Select value={dependencyId} onValueChange={setDependencyId}><SelectTrigger aria-label="Dependency task" className="min-w-0 flex-1"><SelectValue placeholder="Choose a task" /></SelectTrigger><SelectContent>{detail.dependencyOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" disabled={pending || !dependencyId} onClick={() => start(async () => { await addTaskDependency(taskId, dependencyId); setDependencyId(""); setDetail(await getTaskDetail(taskId)); })}>Link</Button></div> : null}
              </div>
              </TabsContent>
              <TabsContent value="comments">
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
                            {item.authorUserId === currentUserId || detail.canManage ? (
                              <form action={(form) => start(async () => { await deleteTaskComment(form); setDetail(await getTaskDetail(taskId)); })}>
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
                  <MentionInput aria-label="Task comment" disabled={!canEdit} candidates={team.map((member) => ({ id: member.id, name: member.name || member.email }))} value={comment} onChange={setComment} placeholder="Add a comment… (type @ to mention someone)" rows={2} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Input aria-label="Comment attachment" disabled={!canEdit || pending} type="file" key={commentFile ? "selected" : "empty"} className="min-w-0 max-w-56 text-xs" onChange={(event) => setCommentFile(event.target.files?.[0] ?? null)} />
                  <Button size="sm" onClick={submitComment} disabled={!canEdit || pending || !comment.trim()}>Add comment</Button>
                </div>
              </div>
              </TabsContent>
              <TabsContent value="activity" className="space-y-3">
                {detail.activities.length === 0 ? <p className="py-5 text-sm text-muted-foreground">No activity yet.</p> : detail.activities.map((item) => <div key={item.id} className="border-l-2 border-primary/40 pl-3"><p className="text-sm"><span className="font-medium">{item.actorName ?? "Someone"}</span> {activityText(item)}</p><time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div>)}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
