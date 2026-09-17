export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export type UploadKind = "document" | "reference" | "design" | "version" | "avatar" | "ticket_attachment" | "task_attachment";

const PRIVATE_KINDS: UploadKind[] = ["document", "reference", "ticket_attachment", "task_attachment"];
export function isPrivateUploadKind(kind: UploadKind) {
  return PRIVATE_KINDS.includes(kind);
}

export function validateUpload(kind: UploadKind, size: number, contentType: string) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > (kind === "avatar" ? 5 * 1024 * 1024 : MAX_UPLOAD_BYTES)) throw new Error("File exceeds the upload size limit or is empty.");
  if (["design", "version", "avatar"].includes(kind) && !IMAGE_TYPES.includes(contentType)) throw new Error("Use a PNG, JPEG, WebP or GIF image.");
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
}