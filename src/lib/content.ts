export type ContentStatus =
  | "draft"
  | "pending_am"
  | "am_changes"
  | "pending_client"
  | "client_changes"
  | "approved"
  | "published";

export type ContentFieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "meta_title"
  | "meta_description"
  | "url"
  | "faq_list"
  | "select";

export type ContentField = {
  key: string;
  label: string;
  type: ContentFieldType;
  required?: boolean;
  help?: string;
  options?: string[];
};

export type FaqEntry = { question: string; answer: string };

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: "Draft",
  pending_am: "Pending AM review",
  am_changes: "Changes requested (AM)",
  pending_client: "Pending client approval",
  client_changes: "Changes requested (client)",
  approved: "Approved",
  published: "Published",
};

export const FIELD_TYPE_LABELS: Record<ContentFieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  richtext: "Rich text (WYSIWYG)",
  meta_title: "Meta title",
  meta_description: "Meta description",
  url: "URL",
  faq_list: "FAQ list",
  select: "Select",
};

export const DEFAULT_TEMPLATE_FIELDS: Record<string, ContentField[]> = {
  blog: [
    { key: "pageName", label: "Page name", type: "text", required: true },
    { key: "title", label: "Headline / title", type: "text", required: true },
    { key: "metaTitle", label: "Meta title", type: "meta_title", help: "Aim for ~60 characters." },
    { key: "metaDescription", label: "Meta description", type: "meta_description", help: "Aim for ~155 characters." },
    { key: "body", label: "Body", type: "richtext", required: true },
    { key: "faqs", label: "FAQs", type: "faq_list" },
  ],
  webpage: [
    { key: "pageName", label: "Page name", type: "text", required: true },
    { key: "url", label: "Page URL", type: "url" },
    { key: "title", label: "H1 / title", type: "text", required: true },
    { key: "metaTitle", label: "Meta title", type: "meta_title" },
    { key: "metaDescription", label: "Meta description", type: "meta_description" },
    { key: "body", label: "Body copy", type: "richtext", required: true },
  ],
};

// Human labels for the content_event.type values.
export const CONTENT_EVENT_LABELS: Record<string, string> = {
  created: "Created",
  edited: "Edited draft",
  submitted: "Submitted for review",
  am_approved: "Approved by account manager",
  am_changes: "Changes requested by account manager",
  sent_to_client: "Sent to client",
  client_approved: "Approved by client",
  client_changes: "Changes requested by client",
  published: "Published",
  comment: "Comment added",
};

export function roleLabel(role: string | null | undefined) {
  switch (role) {
    case "admin":
      return "Admin";
    case "account_manager":
      return "Account manager";
    case "content_writer":
      return "Content writer";
    case "client":
      return "Client";
    default:
      return "System";
  }
}
