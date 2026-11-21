"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { apiRequest } from "@/lib/api-client";
import { ChunkyButton, ProgressBar, Toast } from "@/components/ui";

export type UploadedMedia = { id: string; mimeType: string; size: number; url: string; thumbnailUrl: string | null };
type Presigned = { key: string; url: string; requiredHeaders: Record<string, string> };
type Confirmed = { file: Pick<UploadedMedia, "id" | "mimeType" | "size">; url: string; thumbnailUrl: string | null };
type Props = { value: UploadedMedia | null; poster: UploadedMedia | null; onChange: (media: UploadedMedia | null, poster: UploadedMedia | null) => void };

export function MediaUploader({ value, poster, onChange }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const cancelled = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => { if (!file) { setPreview(null); return; } const next = URL.createObjectURL(file); setPreview(next); return () => URL.revokeObjectURL(next); }, [file]);
  useEffect(() => () => { xhr.current?.abort(); }, []);

  const selectFile = (next?: File) => {
    if (!next) return;
    setError("");
    if (!next.type.startsWith("image/") && !next.type.startsWith("video/")) { setError("Choose a JPEG, PNG, WebP, GIF, MP4, or WebM file."); return; }
    const maximum = next.type.startsWith("image/") ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (next.size <= 0 || next.size > maximum) { setError(`That file is over the ${next.type.startsWith("image/") ? "10 MB" : "100 MB"} limit.`); return; }
    setFile(next);
    onChange(null, null);
    setProgress(0);
  };

  const putObject = (presigned: Presigned, blob: Blob, onProgress: (fraction: number) => void) => new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    xhr.current = request;
    request.open("PUT", presigned.url);
    Object.entries(presigned.requiredHeaders).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Upload didn’t finish. Please try again."));
    request.onerror = () => reject(new Error("Upload connection failed. Check your connection and retry."));
    request.onabort = () => reject(new Error("Upload canceled."));
    request.send(blob);
  });

  const upload = async (current: File, offset: number, span: number): Promise<UploadedMedia> => {
    const signed = await apiRequest<Presigned>("/api/v1/uploads/presign", { method: "POST", body: JSON.stringify({ mimeType: current.type, size: current.size }), signal: requestController.current?.signal });
    if (cancelled.current) throw new Error("Upload canceled.");
    await putObject(signed, current, (fraction) => setProgress(Math.round(offset + fraction * span * .85)));
    const confirmed = await apiRequest<Confirmed>("/api/v1/uploads/confirm", { method: "POST", body: JSON.stringify({ key: signed.key }), signal: requestController.current?.signal });
    if (cancelled.current) throw new Error("Upload canceled.");
    setProgress(Math.round(offset + span));
    return { ...confirmed.file, url: confirmed.url, thumbnailUrl: confirmed.thumbnailUrl };
  };

  const startUpload = async () => {
    if (!file) return;
    setError(""); setUploading(true); setProgress(0); cancelled.current = false; requestController.current = new AbortController();
    try {
      const media = await upload(file, 0, file.type.startsWith("video/") ? 75 : 100);
      let posterResult: UploadedMedia | null = null;
      if (file.type.startsWith("video/")) {
        const posterFile = await createVideoPoster(file);
        if (posterFile) posterResult = await upload(posterFile, 75, 25);
      }
      onChange(media, posterResult);
      setFile(null);
      setProgress(100);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload failed. Please retry.";
      if (!cancelled.current && message !== "Upload canceled.") setError(message);
    } finally { xhr.current = null; requestController.current = null; setUploading(false); }
  };

  const cancel = () => { cancelled.current = true; requestController.current?.abort(); xhr.current?.abort(); setProgress(0); };
  const remove = () => { setFile(null); setProgress(0); onChange(null, null); setError(""); };
  const hasMedia = Boolean(file || value);

  return <div className="space-y-3">
    <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="sr-only" aria-label="Choose memory photo or video" onChange={(event) => selectFile(event.currentTarget.files?.[0])} />
    <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo" onChange={(event) => selectFile(event.currentTarget.files?.[0])} />
    <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }} className={`rounded-3xl border-2 border-dashed p-5 transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border bg-canvas"}`}>
      {preview && file?.type.startsWith("image/") && <Image unoptimized width={720} height={480} src={preview} alt="Selected memory preview" className="mx-auto mb-3 max-h-56 w-auto rounded-2xl object-contain" />}
      {preview && file?.type.startsWith("video/") && <video src={preview} controls className="mx-auto mb-3 max-h-56 rounded-2xl" />}
      {value && <div className="mb-3 text-center text-sm font-bold text-primary-foreground">✓ {value.mimeType.startsWith("video/") ? "Video" : "Photo"} uploaded securely{poster ? " with poster frame" : ""}.</div>}
      <p className="text-center font-bold">Drop a photo or video here, or choose one</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2"><ChunkyButton type="button" size="sm" variant="secondary" disabled={uploading} onClick={() => picker.current?.click()}>Choose file</ChunkyButton><ChunkyButton type="button" size="sm" variant="ghost" disabled={uploading} onClick={() => camera.current?.click()}>Take a photo</ChunkyButton>{file && !uploading && <ChunkyButton type="button" size="sm" onClick={() => void startUpload()}>Upload</ChunkyButton>}{file && !uploading && <ChunkyButton type="button" size="sm" variant="ghost" onClick={remove}>Remove</ChunkyButton>}{uploading && <ChunkyButton type="button" size="sm" variant="danger" onClick={cancel}>Cancel upload</ChunkyButton>}</div>
      {uploading && <div className="mt-4"><ProgressBar value={progress} label="Uploading memory" /></div>}
    </div>
    {error && <Toast tone="error" message={error} />}
    {hasMedia && value && <button type="button" className="text-sm font-bold underline" onClick={remove}>Remove uploaded media</button>}
  </div>;
}

async function createVideoPoster(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true; video.preload = "metadata"; video.src = url;
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("Couldn’t preview this video.")); });
    const frameTime = Math.min(.5, Number.isFinite(video.duration) ? Math.max(0, video.duration / 2) : .5);
    if (frameTime > 0) {
      const seeked = new Promise<void>((resolve, reject) => { video.onseeked = () => resolve(); video.onerror = () => reject(new Error("Couldn’t create a video poster.")); });
      video.currentTime = frameTime;
      await seeked;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(640, video.videoWidth || 640);
    canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * canvas.width / Math.max(1, video.videoWidth)));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .82));
    return blob ? new File([blob], "poster.webp", { type: "image/webp" }) : null;
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

