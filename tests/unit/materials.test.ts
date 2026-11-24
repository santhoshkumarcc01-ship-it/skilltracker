import { describe, expect, it } from "vitest";
import { sanitizeNoteHtml } from "@/shared/sanitization/note-sanitizer";
import { assertUploadSize } from "@/backend/lib/storage-rules";
import { createMaterialSchema } from "@/backend/validators/materials";

describe("Material Library content policy", () => {
  it("removes scripts, event handlers, and unsafe URL protocols from note HTML", () => {
    const clean = sanitizeNoteHtml('<h2 onclick="alert(1)">Study</h2><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(2)" target="_blank">bad</a><p><strong>safe</strong></p>');
    expect(clean).toContain("<h2>Study</h2>");
    expect(clean).toContain("<strong>safe</strong>");
    expect(clean).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
  });

  it("allows only the Material Library MIME set and enforces 25 MB", () => {
    expect(() => assertUploadSize("application/pdf", 25 * 1024 * 1024, "material")).not.toThrow();
    expect(() => assertUploadSize("image/png", 25 * 1024 * 1024 + 1, "material")).toThrow();
    expect(() => assertUploadSize("video/webm", 1024, "material")).toThrow();
    expect(() => assertUploadSize("application/x-msdownload", 500, "material")).toThrow();
    expect(() => assertUploadSize("image/png", 10 * 1024 * 1024 + 1, "story")).toThrow();
  });

  it("validates material type-specific fields", () => {
    expect(createMaterialSchema.safeParse({ type: "NOTE", title: "A note", content: "<p>hello</p>", tags: [] }).success).toBe(true);
    expect(createMaterialSchema.safeParse({ type: "FILE", title: "No file", content: "", tags: [] }).success).toBe(false);
    expect(createMaterialSchema.safeParse({ type: "LINK", title: "No link", content: "", tags: [] }).success).toBe(false);
  });
});
