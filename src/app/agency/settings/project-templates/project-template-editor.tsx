"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DeliverableType, ProjectDeliverableTemplate, ProjectMilestoneTemplate } from "@/lib/project-templates";
import { saveProjectTemplate } from "./actions";

const DELIVERABLE_TYPES: DeliverableType[] = ["design", "content", "document"];
const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = { design: "Design", content: "Content", document: "Document" };

type ClientType = { id: string; label: string };

export function ProjectTemplateEditor({
  templateId,
  name: initialName,
  clientTypeId: initialClientTypeId,
  milestones: initialMilestones,
  deliverables: initialDeliverables,
  clientTypes,
}: {
  templateId: string;
  name: string;
  clientTypeId: string | null;
  milestones: ProjectMilestoneTemplate[];
  deliverables: ProjectDeliverableTemplate[];
  clientTypes: ClientType[];
}) {
  const [name, setName] = useState(initialName);
  const [clientTypeId, setClientTypeId] = useState<string | null>(initialClientTypeId);
  const [milestones, setMilestones] = useState<ProjectMilestoneTemplate[]>(initialMilestones ?? []);
  const [deliverables, setDeliverables] = useState<ProjectDeliverableTemplate[]>(initialDeliverables ?? []);
  const [pending, start] = useTransition();

  const updateMilestone = (index: number, patch: Partial<ProjectMilestoneTemplate>) =>
    setMilestones((prev) => prev.map((milestone, i) => (i === index ? { ...milestone, ...patch } : milestone)));
  const addMilestone = () => setMilestones((prev) => [...prev, { title: "New milestone" }]);
  const removeMilestone = (index: number) => setMilestones((prev) => prev.filter((_, i) => i !== index));
  const moveMilestone = (index: number, direction: number) =>
    setMilestones((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const updateDeliverable = (index: number, patch: Partial<ProjectDeliverableTemplate>) =>
    setDeliverables((prev) => prev.map((deliverable, i) => (i === index ? { ...deliverable, ...patch } : deliverable)));
  const addDeliverable = () => setDeliverables((prev) => [...prev, { type: "design", title: "New deliverable", standard: true }]);
  const removeDeliverable = (index: number) => setDeliverables((prev) => prev.filter((_, i) => i !== index));

  const save = () =>
    start(async () => {
      await saveProjectTemplate(templateId, name, clientTypeId, milestones, deliverables);
      toast.success("Project template saved");
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Template name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Client type</Label>
          <Select value={clientTypeId ?? "none"} onValueChange={(value) => setClientTypeId(value === "none" ? null : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific client type</SelectItem>
              {clientTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Milestones</Label>
        <div className="space-y-2">
          {milestones.map((milestone, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md border p-2">
              <Input className="flex-1" value={milestone.title} onChange={(event) => updateMilestone(index, { title: event.target.value })} />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveMilestone(index, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveMilestone(index, 1)}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeMilestone(index)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addMilestone}>Add milestone</Button>
      </div>

      <div className="space-y-2">
        <Label>Required deliverables</Label>
        <p className="text-xs text-muted-foreground">What designs/content are standard for this project type, and what only applies sometimes.</p>
        <div className="space-y-3">
          {deliverables.map((deliverable, index) => (
            <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={deliverable.type} onValueChange={(value) => updateDeliverable(index, { type: value as DeliverableType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DELIVERABLE_TYPES.map((type) => <SelectItem key={type} value={type}>{DELIVERABLE_TYPE_LABELS[type]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={deliverable.title} onChange={(event) => updateDeliverable(index, { title: event.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea rows={1} value={deliverable.description ?? ""} onChange={(event) => updateDeliverable(index, { description: event.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1 text-xs"><Checkbox checked={deliverable.standard} onCheckedChange={(value) => updateDeliverable(index, { standard: Boolean(value) })} />Standard</label>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeDeliverable(index)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addDeliverable}>Add deliverable</Button>
      </div>

      <Button type="button" onClick={save} disabled={pending}>Save template</Button>
    </div>
  );
}
