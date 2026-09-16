import { expect, it } from "vitest";
import { safeFileName, validateUpload, MAX_UPLOAD_BYTES } from "@/lib/upload-policy";

it("accepts arbitrary reference types but limits bytes", () => {
  expect(() => validateUpload("reference", 12, "application/octet-stream")).not.toThrow();
  expect(() => validateUpload("document", MAX_UPLOAD_BYTES + 1, "text/plain")).toThrow();
  expect(() => validateUpload("reference", 0, "text/plain")).toThrow();
});
it("rejects active SVG and HTML in image slots", () => {
  for (const type of ["image/svg+xml", "text/html", "application/javascript"]) expect(() => validateUpload("design", 100, type)).toThrow();
});
it("removes traversal and header injection from filenames", () => {
  expect(safeFileName("../../foo\r\n.html")).not.toMatch(/[\/\r\n]/);
});