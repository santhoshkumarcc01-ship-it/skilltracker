"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { ChunkyButton, ProgressBar, Toast } from "@/components/ui";

export type UploadedMaterialFile = { id: string; mimeType: string; size: number; url: string; thumbnailUrl: string | null };
type Presigned = { key: string; url: string; requiredHeaders: Record<string, string> };
type Confirmed = { file: Pick<UploadedMaterialFile, "id" | "mimeType" | "size">; url: string; thumbnailUrl: string | null };
const allAccept = ".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,image/jpeg,image/png,image/webp,image/gif";
const mimeAliases: Record<string, string> = { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
const extensionMimes: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4" };
function fileMime(file: File) { const extension = file.name.split(".").at(-1)?.toLowerCase() ?? ""; return mimeAliases[file.type] ?? (file.type || extensionMimes[extension] || ""); }

export function MaterialFileUpload({ value, onChange, videoOnly = false }: { value: UploadedMaterialFile | null; onChange: (file: UploadedMaterialFile | null) => void; videoOnly?: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const controller = useRef<AbortController | null>(null);
  const cancelled = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => { xhr.current?.abort(); controller.current?.abort(); }, []);
  const pick = (next?: File) => {
    if (!next) return;
    const mime = fileMime(next);
    const valid = videoOnly ? mime === "video/mp4" : ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime);
    if (!valid) { setError("Choose a PDF, DOCX, PPTX, TXT, image, or MP4 video."); return; }
    if (next.size <= 0 || next.size > 25 * 1024 * 1024) { setError("Files must be smaller than 25 MB."); return; }
    setError(""); setFile(next); setProgress(0); onChange(null);
  };
  const upload = async () => {
    if (!file) return;
    setBusy(true); setProgress(0); setError(""); cancelled.current = false; controller.current = new AbortController();
    try {
      const presign = await apiRequest<Presigned>("/api/v1/materials/uploads/presign", { method: "POST", body: JSON.stringify({ purpose: "material", mimeType: fileMime(file), size: file.size }), signal: controller.current.signal });
      if (cancelled.current) return;
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest(); xhr.current = request; request.open("PUT", presign.url);
        Object.entries(presign.requiredHeaders).forEach(([key, value]) => request.setRequestHeader(key, value));
        request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 90)); };
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Upload didn’t finish. Please retry."));
        request.onerror = () => reject(new Error("Upload connection failed. Check your connection and retry."));
        request.onabort = () => reject(new Error("Upload canceled.")); request.send(file);
      });
      if (cancelled.current) return;
      const result = await apiRequest<Confirmed>("/api/v1/uploads/confirm", { method: "POST", body: JSON.stringify({ key: presign.key }), signal: controller.current.signal });
      if (cancelled.current) return;
      setProgress(100); onChange({ ...result.file, url: result.url, thumbnailUrl: result.thumbnailUrl }); setFile(null);
    } catch (reason) { if (!cancelled.current) setError(reason instanceof Error ? reason.message : "Upload failed. Please try again."); }
    finally { xhr.current = null; controller.current = null; setBusy(false); }
  };
  const cancel = () => { cancelled.current = true; xhr.current?.abort(); controller.current?.abort(); };
  const remove = () => { setFile(null); setProgress(0); setError(""); onChange(null); };
  return <div className="space-y-3">
    <input ref={picker} type="file" accept={videoOnly ? "video/mp4,.mp4" : allAccept} className="sr-only" aria-label={videoOnly ? "Choose MP4 video" : "Choose library file"} onChange={(event) => pick(event.currentTarget.files?.[0])} />
    <div onDragOver={(event) => event.preventDefault()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files[0]); }} className={`rounded-3xl border-2 border-dashed p-5 ${dragging ? "border-primary bg-primary/10" : "border-border bg-canvas"}`}>
      {value && <p className="mb-3 text-center text-sm font-bold text-primary-foreground">✓ File uploaded securely · {formatBytes(value.size)}</p>}
      <p className="text-center font-bold">Drop a {videoOnly ? "video" : "file"} here, or choose one</p><p className="mt-1 text-center text-xs text-ink/80">{videoOnly ? "MP4 video" : "PDF, DOCX, PPTX, TXT, images, or MP4"} · up to 25 MB</p>
      <div className="mt-3 flex justify-center gap-2"><ChunkyButton type="button" size="sm" variant="secondary" disabled={busy} onClick={() => picker.current?.click()}>Choose file</ChunkyButton>{file && !busy && <ChunkyButton type="button" size="sm" onClick={() => void upload()}>Upload</ChunkyButton>}{file && !busy && <ChunkyButton type="button" size="sm" variant="ghost" onClick={remove}>Remove</ChunkyButton>}{busy && <ChunkyButton type="button" size="sm" variant="danger" onClick={cancel}>Cancel</ChunkyButton>}{value && !file && <ChunkyButton type="button" size="sm" variant="ghost" onClick={remove}>Remove uploaded file</ChunkyButton>}</div>
      {busy && <div className="mt-4"><ProgressBar value={progress} label="Uploading library file" /></div>}
    </div>{error && <Toast tone="error" message={error} />}
  </div>;
}
function formatBytes(bytes: number) { return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }

