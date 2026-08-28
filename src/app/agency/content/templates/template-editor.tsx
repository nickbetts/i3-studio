"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_TYPE_LABELS, type ContentField, type ContentFieldType } from "@/lib/content";
import { saveTemplateFields } from "../actions";

const TYPES: ContentFieldType[] = ["text", "textarea", "richtext", "meta_title", "meta_description", "url", "faq_list", "select"];

export function TemplateEditor({ templateId, name: initialName, fields: initialFields }: { templateId: string; name: string; fields: ContentField[] }) {
  const [name, setName] = useState(initialName);
  const [fields, setFields] = useState<ContentField[]>(initialFields ?? []);
  const [pending, start] = useTransition();

  const update = (index: number, patch: Partial<ContentField>) => setFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  const addField = () => setFields((prev) => [...prev, { key: `field_${prev.length + 1}`, label: "New field", type: "text" }]);
  const remove = (index: number) => setFields((prev) => prev.filter((_, i) => i !== index));
  const move = (index: number, direction: number) =>
    setFields((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = () =>
    start(async () => {
      await saveTemplateFields(templateId, name, fields);
      toast.success("Template saved");
    });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Template name</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Key</Label>
              <Input value={field.key} onChange={(event) => update(index, { key: event.target.value.replace(/\s+/g, "_") })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input value={field.label} onChange={(event) => update(index, { label: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={field.type} onValueChange={(value) => update(index, { type: value as ContentFieldType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{FIELD_TYPE_LABELS[type]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-1">
              <label className="mr-1 flex items-center gap-1 text-xs"><Checkbox checked={!!field.required} onCheckedChange={(value) => update(index, { required: Boolean(value) })} />Req</label>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addField}>Add field</Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>Save template</Button>
      </div>
    </div>
  );
}
