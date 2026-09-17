"use client";
import { upload } from "@vercel/blob/client";
import { isPrivateUploadKind, safeFileName, validateUpload, type UploadKind } from "./upload-policy";

export async function prepareUpload(form: FormData, kind: UploadKind, progress?: (percentage: number) => void) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose a file.");
  validateUpload(kind, file.size, file.type);
  const privateFile = isPrivateUploadKind(kind);
  const result = await upload(`uploads/${crypto.randomUUID()}/${safeFileName(file.name)}`, file, {
    access: privateFile ? "private" : "public", handleUploadUrl: "/api/uploads", multipart: file.size > 4 * 1024 * 1024,
    clientPayload: JSON.stringify({ kind, clientAccountId: form.get("clientAccountId"), designAssetId: form.get("designAssetId"), userId: form.get("userId"), size: file.size, contentType: file.type, fileName: file.name }),
    onUploadProgress: (event) => progress?.(event.percentage),
  });
  form.delete("file");
  form.set("uploadedUrl", result.url);
  return form;
}