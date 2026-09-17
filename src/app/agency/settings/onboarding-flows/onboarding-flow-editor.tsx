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
import type { OnboardingFlowField, OnboardingFlowFieldType, OnboardingFlowStep } from "@/lib/onboarding-flow";
import { useUnsavedChangesWarning } from "@/lib/use-unsaved-changes-warning";
import { saveOnboardingFlow } from "./actions";

const FIELD_TYPES: OnboardingFlowFieldType[] = ["text", "url", "email", "tel", "textarea", "select", "checkbox"];
const FIELD_TYPE_LABELS: Record<OnboardingFlowFieldType, string> = { text: "Text", url: "URL", email: "Email", tel: "Phone", textarea: "Long text", select: "Select", checkbox: "Checkbox" };

type ClientType = { id: string; label: string };

export function OnboardingFlowEditor({
  flowId,
  name: initialName,
  clientTypeId: initialClientTypeId,
  steps: initialSteps,
  clientTypes,
}: {
  flowId: string;
  name: string;
  clientTypeId: string | null;
  steps: OnboardingFlowStep[];
  clientTypes: ClientType[];
}) {
  const [name, setName] = useState(initialName);
  const [clientTypeId, setClientTypeId] = useState<string | null>(initialClientTypeId);
  const [steps, setSteps] = useState<OnboardingFlowStep[]>(initialSteps ?? []);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify({ name, clientTypeId, steps }) !== JSON.stringify({ name: initialName, clientTypeId: initialClientTypeId, steps: initialSteps ?? [] });
  useUnsavedChangesWarning(dirty);

  const updateStep = (index: number, patch: Partial<OnboardingFlowStep>) =>
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const addStep = () => setSteps((prev) => [...prev, { title: "New step", description: "", fields: [] }]);
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index));
  const moveStep = (index: number, direction: number) =>
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const updateField = (stepIndex: number, fieldIndex: number, patch: Partial<OnboardingFlowField>) =>
    setSteps((prev) => prev.map((step, i) => (i === stepIndex ? { ...step, fields: step.fields.map((field, j) => (j === fieldIndex ? { ...field, ...patch } : field)) } : step)));
  const addField = (stepIndex: number) =>
    setSteps((prev) => prev.map((step, i) => (i === stepIndex ? { ...step, fields: [...step.fields, { key: `field_${step.fields.length + 1}`, label: "New question", type: "text" as const }] } : step)));
  const removeField = (stepIndex: number, fieldIndex: number) =>
    setSteps((prev) => prev.map((step, i) => (i === stepIndex ? { ...step, fields: step.fields.filter((_, j) => j !== fieldIndex) } : step)));

  const save = () =>
    start(async () => {
      await saveOnboardingFlow(flowId, name, clientTypeId, steps);
      toast.success("Onboarding flow saved");
    });

  return (
    <div className="space-y-5">
      {dirty ? <p className="text-xs text-amber-600 dark:text-amber-400">You have unsaved changes.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Flow name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Client type</Label>
          <Select value={clientTypeId ?? "none"} onValueChange={(value) => setClientTypeId(value === "none" ? null : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default flow (used when a type has none of its own)</SelectItem>
              {clientTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, stepIndex) => (
          <div key={stepIndex} className="space-y-3 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Step title</Label>
                <Input value={step.title} onChange={(event) => updateStep(stepIndex, { title: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Step description</Label>
                <Input value={step.description} onChange={(event) => updateStep(stepIndex, { description: event.target.value })} />
              </div>
              <div className="flex items-end gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveStep(stepIndex, -1)}><ArrowUp className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveStep(stepIndex, 1)}><ArrowDown className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeStep(stepIndex)}><Trash2 className="size-4" /></Button>
              </div>
            </div>

            <div className="space-y-2 pl-3">
              {step.fields.map((field, fieldIndex) => (
                <div key={fieldIndex} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label className="text-xs">Key</Label>
                    <Input value={field.key} onChange={(event) => updateField(stepIndex, fieldIndex, { key: event.target.value.replace(/\s+/g, "_") })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Question</Label>
                    <Input value={field.label} onChange={(event) => updateField(stepIndex, fieldIndex, { label: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={field.type} onValueChange={(value) => updateField(stepIndex, fieldIndex, { type: value as OnboardingFlowFieldType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FIELD_TYPES.map((type) => <SelectItem key={type} value={type}>{FIELD_TYPE_LABELS[type]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-1">
                    <label className="mr-1 flex items-center gap-1 text-xs"><Checkbox checked={!!field.required} onCheckedChange={(value) => updateField(stepIndex, fieldIndex, { required: Boolean(value) })} />Req</label>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(stepIndex, fieldIndex)}><Trash2 className="size-4" /></Button>
                  </div>
                  {field.type === "select" ? (
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs">Options (comma separated)</Label>
                      <Textarea rows={1} value={(field.options ?? []).join(", ")} onChange={(event) => updateField(stepIndex, fieldIndex, { options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) })} />
                    </div>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addField(stepIndex)}>Add question</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addStep}>Add step</Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>Save flow</Button>
      </div>
    </div>
  );
}
