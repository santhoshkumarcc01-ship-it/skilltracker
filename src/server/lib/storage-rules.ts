import { isIP } from "node:net";
import { ApiError } from "@/server/lib/api";

export const IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;
export const VIDEO_LIMIT_BYTES = 100 * 1024 * 1024;
export const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
} as const;
export type AllowedUploadMime = keyof typeof MIME_EXTENSIONS;
export const STORY_UPLOAD_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"] as const;
export const MATERIAL_UPLOAD_MIMES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"] as const;
export type UploadPurpose = "story" | "material" | "motivation";

export function assertUploadSize(mimeType: string, size: number, purpose: UploadPurpose = "story"): asserts mimeType is AllowedUploadMime {
  const allowlist: readonly string[] = purpose === "material" ? MATERIAL_UPLOAD_MIMES : STORY_UPLOAD_MIMES;
  if (!allowlist.includes(mimeType)) throw new ApiError(415, "UNSUPPORTED_MEDIA", "This file type is not supported here.");
  const max = purpose === "material" ? 25 * 1024 * 1024 : mimeType.startsWith("image/") ? IMAGE_LIMIT_BYTES : VIDEO_LIMIT_BYTES;
  if (!Number.isSafeInteger(size) || size <= 0 || size > max) throw new ApiError(413, "UPLOAD_TOO_LARGE", `This file exceeds the ${purpose === "material" ? "25 MB" : mimeType.startsWith("image/") ? "10 MB" : "100 MB"} limit.`);
}

export function sniffMime(bytes: Uint8Array, expected?: AllowedUploadMime): AllowedUploadMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return "image/gif";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") return "video/mp4";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (expected === "text/plain" && bytes.length > 0 && !bytes.includes(0)) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return "text/plain"; } catch { return null; }
  }
  if ((expected === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || expected === "application/vnd.openxmlformats-officedocument.presentationml.presentation") && bytes.length >= 4 && ascii(bytes, 0, 2) === "PK") {
    const docx = zipHasEntry(bytes, "word/document.xml");
    const pptx = zipHasEntry(bytes, "ppt/presentation.xml");
    if (docx && expected === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return expected;
    if (pptx && expected === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return expected;
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function zipHasEntry(bytes: Uint8Array, wanted: string) {
  const start = Math.max(0, bytes.length - 65_557);
  const decoder = new TextDecoder();
  for (let index = start; index + 46 <= bytes.length; index += 1) {
    if (bytes[index] !== 0x50 || bytes[index + 1] !== 0x4b || bytes[index + 2] !== 0x01 || bytes[index + 3] !== 0x02) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset + index, bytes.byteLength - index);
    const filenameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    const end = index + 46 + filenameLength + extraLength + commentLength;
    if (!filenameLength || end > bytes.length) continue;
    if (decoder.decode(bytes.subarray(index + 46, index + 46 + filenameLength)) === wanted) return true;
    index = end - 1;
  }
  return false;
}

export type ExternalMedia = { url: string; kind: "youtube" | "vimeo" | "image" | "link"; embedUrl: string | null };
const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"]);
const vimeoHosts = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

export function resolveExternalMedia(raw: string): ExternalMedia {
  let url: URL;
  try { url = new URL(raw); } catch { throw invalidUrl(); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw invalidUrl();
  if (url.username || url.password || isPrivateHost(url.hostname)) throw invalidUrl();
  const hostname = url.hostname.toLowerCase();
  if (youtubeHosts.has(hostname)) {
    const id = youtubeId(url, hostname);
    if (id) return { url: url.toString(), kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (vimeoHosts.has(hostname)) {
    const id = vimeoId(url);
    if (id) return { url: url.toString(), kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
  }
  const extension = url.pathname.split(".").at(-1)?.toLowerCase() ?? "";
  return { url: url.toString(), kind: url.protocol === "https:" && imageExtensions.has(extension) ? "image" : "link", embedUrl: null };
}

function youtubeId(url: URL, host: string) {
  const parts = url.pathname.split("/").filter(Boolean);
  const id = host === "youtu.be" ? parts[0] : url.searchParams.get("v") ?? (parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : null);
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
function vimeoId(url: URL) {
  const match = url.pathname.match(/(?:^|\/)(?:video\/)?(\d+)(?:\/|$)/);
  return match?.[1] ?? null;
}
function invalidUrl() { return new ApiError(400, "INVALID_MEDIA_URL", "Use a public HTTP or HTTPS URL without credentials or a private-network host."); }

function isPrivateHost(host: string) {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized.endsWith(".internal")) return true;
  const version = isIP(normalized);
  if (version === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b! >= 64 && b! <= 127) || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)) || (a! >= 224);
  }
  if (version === 6) return normalized === "::" || normalized === "::1" || normalized.startsWith("::ffff:") || normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized);
  return false;
}
