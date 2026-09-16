import { describe, expect, it } from "vitest";
import { safeContentData, safeHtml } from "@/lib/safe-html";

describe("rich-text safety", () => {
  it.each([
    '<script>alert(1)</script><p>Safe</p>',
    '<img src=x onerror="alert(1)"><p>Safe</p>',
    '<svg onload="alert(1)"></svg><p>Safe</p>',
    '<iframe srcdoc="bad"></iframe><p>Safe</p>',
  ])("strips active HTML: %s", (html) => { expect(safeHtml(html)).toBe("<p>Safe</p>"); });
  it("strips unsafe URL schemes", () => {
    expect(safeHtml('<a href="javascript:alert(1)">link</a>')).toBe("<a>link</a>");
    expect(safeHtml('<a href="//evil.example">link</a>')).toBe("<a>link</a>");
  });
  it("retains supported formatting", () => {
    const html = '<h2>Title</h2><p><strong>Bold</strong></p><ul><li>One</li></ul>';
    expect(safeHtml(html)).toBe(html);
  });
  it("sanitizes FAQ fields too", () => {
    expect(safeContentData({ faqs: [{ question: "Test", answer: "<script>bad</script>OK" }] })).toEqual({ faqs: [{ question: "Test", answer: "OK" }] });
  });
  it("rejects malformed or oversized data", () => {
    expect(() => safeContentData({ body: "a".repeat(500_001) })).toThrow();
    expect(() => safeContentData({ faqs: [null] })).toThrow();
  });
});