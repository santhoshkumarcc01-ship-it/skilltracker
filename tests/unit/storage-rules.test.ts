import { describe, expect, it } from "vitest";
import { ApiError } from "@/server/lib/api";
import { assertUploadSize, IMAGE_LIMIT_BYTES, resolveExternalMedia, sniffMime, VIDEO_LIMIT_BYTES } from "@/server/lib/storage-rules";

describe("secure upload policy", () => {
  it("sniffs supported media from magic bytes", () => {
    expect(sniffMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(sniffMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMime(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffMime(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
    expect(sniffMime(new TextEncoder().encode("0000ftypisom"))).toBe("video/mp4");
    expect(sniffMime(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe("video/webm");
    expect(sniffMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("enforces the separate image and video size ceilings", () => {
    expect(() => assertUploadSize("image/png", IMAGE_LIMIT_BYTES)).not.toThrow();
    expect(() => assertUploadSize("image/png", IMAGE_LIMIT_BYTES + 1)).toThrow(ApiError);
    expect(() => assertUploadSize("video/mp4", VIDEO_LIMIT_BYTES)).not.toThrow();
    expect(() => assertUploadSize("video/mp4", VIDEO_LIMIT_BYTES + 1)).toThrow(ApiError);
    expect(() => assertUploadSize("image/svg+xml", 100)).toThrow(ApiError);
  });
});

describe("external media URLs", () => {
  it("converts only valid YouTube and Vimeo URLs to safe embed URLs", () => {
    expect(resolveExternalMedia("https://youtu.be/abcdefghijk").embedUrl).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(resolveExternalMedia("https://www.youtube.com/watch?v=abcdefghijk&feature=share").embedUrl).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(resolveExternalMedia("https://vimeo.com/12345678").embedUrl).toBe("https://player.vimeo.com/video/12345678");
    expect(resolveExternalMedia("https://notyoutube.com/watch?v=abcdefghijk").embedUrl).toBeNull();
  });

  it("rejects non-web schemes, credentials, and private-network destinations", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,hello", "file:///etc/passwd", "ftp://example.com/a", "http://127.0.0.1/image.jpg", "http://2130706433/image.jpg", "http://192.168.1.2/a", "http://169.254.169.254/latest/meta-data", "http://[::ffff:7f00:1]/a", "https://user:pass@example.com/a"]) {
      expect(() => resolveExternalMedia(url), url).toThrow(ApiError);
    }
    expect(resolveExternalMedia("https://images.example.test/memory.webp").kind).toBe("image");
    expect(resolveExternalMedia("http://images.example.test/memory.webp").kind).toBe("link");
  });
});
