import sanitize from "sanitize-html";

export function safeHtml(html: string) {
  return sanitize(html, {
    allowedTags: ["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "u", "s", "ul", "ol", "li", "blockquote", "a", "code", "pre", "hr", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "title"], ol: ["start"], th: ["colspan", "rowspan"], td: ["colspan", "rowspan"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
}

export function safeContentData(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || Array.isArray(data) || typeof data !== "object" || JSON.stringify(data).length > 500_000) throw new Error("Invalid content size.");
  return Object.fromEntries(Object.entries(data).map(([key, value]) => {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid field key.");
    if (typeof value === "string") return [key, safeHtml(value)];
    if (Array.isArray(value)) return [key, value.map((entry) => {
      if (!entry || typeof entry.question !== "string" || typeof entry.answer !== "string") throw new Error("Invalid FAQ.");
      return { question: safeHtml(entry.question), answer: safeHtml(entry.answer) };
    })];
    throw new Error("Invalid field value.");
  }));
}