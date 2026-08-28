import type { ContentField, FaqEntry } from "@/lib/content";

const richClass =
  "text-sm [&_h1]:mt-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold";

export function ContentView({ fields, data }: { fields: ContentField[]; data: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
          <FieldValue field={field} value={data[field.key]} />
        </div>
      ))}
    </div>
  );
}

function FieldValue({ field, value }: { field: ContentField; value: unknown }) {
  if (field.type === "richtext") {
    const html = String(value ?? "").trim();
    return html ? <div className={richClass} dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-sm text-muted-foreground">—</p>;
  }
  if (field.type === "faq_list") {
    const faqs = Array.isArray(value) ? (value as FaqEntry[]) : [];
    if (faqs.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
    return (
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <div key={index} className="rounded-md border p-3">
            <p className="text-sm font-medium">{faq.question || "—"}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{faq.answer}</p>
          </div>
        ))}
      </div>
    );
  }
  const str = String(value ?? "").trim();
  return str ? <p className="whitespace-pre-wrap text-sm">{str}</p> : <p className="text-sm text-muted-foreground">—</p>;
}
