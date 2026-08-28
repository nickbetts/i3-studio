"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { ContentField, FaqEntry } from "@/lib/content";
import { saveDraft, submitForReview } from "@/app/agency/content/actions";

export function ContentEditor({ itemId, fields, initialData, canSubmit }: { itemId: string; fields: ContentField[]; initialData: Record<string, unknown>; canSubmit: boolean }) {
  const [data, setData] = useState<Record<string, unknown>>(initialData ?? {});
  const [pending, start] = useTransition();
  const setField = (key: string, value: unknown) => setData((prev) => ({ ...prev, [key]: value }));

  const missingRequired = fields.filter((field) => field.required && !String((data[field.key] as string) ?? "").replace(/<[^>]*>/g, "").trim());

  const save = () =>
    start(async () => {
      await saveDraft(itemId, data);
      toast.success("Draft saved");
    });

  const submit = () => {
    if (missingRequired.length > 0) {
      toast.error(`Fill in: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }
    start(async () => {
      await submitForReview(itemId, data);
      toast.success("Submitted for review");
    });
  };

  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={`f-${field.key}`}>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</Label>
          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
          <FieldInput field={field} value={data[field.key]} onChange={(value) => setField(field.key, value)} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="outline" onClick={save} disabled={pending}>Save draft</Button>
        {canSubmit ? <Button onClick={submit} disabled={pending}>Submit for review</Button> : null}
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: ContentField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === "richtext") {
    return <RichTextEditor value={(value as string) ?? ""} onChange={onChange} />;
  }
  if (field.type === "textarea" || field.type === "meta_description") {
    return <Textarea id={`f-${field.key}`} value={(value as string) ?? ""} onChange={(event) => onChange(event.target.value)} rows={field.type === "meta_description" ? 2 : 4} />;
  }
  if (field.type === "select") {
    return (
      <Select value={(value as string) ?? ""} onValueChange={onChange}>
        <SelectTrigger id={`f-${field.key}`}><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>{(field.options ?? []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  if (field.type === "faq_list") {
    const faqs = Array.isArray(value) ? (value as FaqEntry[]) : [];
    const update = (next: FaqEntry[]) => onChange(next);
    return (
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <div key={index} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">FAQ {index + 1}</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => update(faqs.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
            </div>
            <Input placeholder="Question" value={faq.question} onChange={(event) => update(faqs.map((item, i) => (i === index ? { ...item, question: event.target.value } : item)))} />
            <Textarea placeholder="Answer" rows={2} value={faq.answer} onChange={(event) => update(faqs.map((item, i) => (i === index ? { ...item, answer: event.target.value } : item)))} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => update([...faqs, { question: "", answer: "" }])}><Plus className="size-4" />Add FAQ</Button>
      </div>
    );
  }
  return <Input id={`f-${field.key}`} value={(value as string) ?? ""} onChange={(event) => onChange(event.target.value)} />;
}
