"use client";

import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { m, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react";
import { apiRequest } from "@/frontend/lib/api-client";
import { emitGameEvent } from "@/frontend/lib/game-events";
import { MOTIVATION_QUOTES, quoteOfTheDay } from "@/frontend/lib/motivation/quotes";
import { Card, ChunkyButton, EmptyState, ProgressBar, Skeleton, Toast } from "@/frontend/components/ui";
import { PET_COMPONENTS } from "@/frontend/components/pets/PetIllustrations";
import { clampBoardPosition, orderByBoardLayer } from "@/shared/motivation/board-math";
import type { stickyColors, paperStyles } from "@/shared/validators/motivation";

type Color = typeof stickyColors[number];
type PaperStyle = typeof paperStyles[number];
type BoardNote = {
  id: string; kind: "STICKY" | "PAPER"; text: string; quote: string | null; attribution: string | null;
  fileId: string | null; imageUrl: string | null; thumbnailUrl: string | null; color: Color; paperStyle: PaperStyle;
  x: number; y: number; width: number; height: number; rotation: number; zIndex: number; pinned: boolean;
  createdAt: string; updatedAt: string;
};
type Favorite = { id: string; quote: string; author: string };
type BoardData = { notes: BoardNote[]; favorites: Favorite[] };
type ThemeName = "cork" | "pastel" | "lavender" | "ocean";
type Gesture = { id: string; action: "move" | "resize"; pointerId: number; startX: number; startY: number; initial: Pick<BoardNote, "x" | "y" | "width" | "height">; last: Partial<BoardNote> };

const pastelSwatches: Record<Color, string> = {
  lemon: "var(--palette-fff2a8)", peach: "var(--palette-ffd8c8)", mint: "var(--palette-cbf2d2)", lavender: "var(--palette-e6d5ff)",
  sky: "var(--palette-cdeeff)", rose: "var(--palette-ffd1de)", cream: "var(--palette-fff4d6)", lilac: "var(--palette-d8dfff)",
};
const paperTextures: Record<PaperStyle, string> = {
  lined: "bg-[var(--palette-fffdf7)] bg-[linear-gradient(transparent_27px,var(--palette-b8d7e7)_28px)] bg-[length:100%_28px]",
  grid: "bg-[var(--palette-fffdf7)] bg-[linear-gradient(var(--palette-d7d7e5)_1px,transparent_1px),linear-gradient(90deg,var(--palette-d7d7e5)_1px,transparent_1px)] bg-[length:18px_18px]",
  kraft: "bg-[radial-gradient(var(--palette-aa825044)_.7px,transparent_.7px)] bg-[length:8px_8px] bg-[var(--palette-ddc49c)]",
  pastel: "bg-gradient-to-br from-[var(--palette-fff2a8)] via-[var(--palette-ffe0ed)] to-[var(--palette-d7efff)]",
  washi: "bg-[repeating-linear-gradient(135deg,var(--palette-f8dff1)_0_12px,var(--palette-dff3f0)_12px_24px)]",
  polaroid: "bg-white pb-10",
};
const themeStyles: Record<ThemeName, string> = {
  cork: "bg-[var(--palette-a8784e)] [background-image:radial-gradient(var(--palette-65462c33)_1px,transparent_1px),radial-gradient(var(--palette-f0c89055)_1px,transparent_1px)] [background-position:0_0,8px_8px] [background-size:16px_16px]",
  pastel: "bg-[var(--palette-f2e9df)] [background-image:radial-gradient(var(--palette-9c7d5a20)_.8px,transparent_.8px)] [background-size:12px_12px]",
  lavender: "bg-[var(--palette-d9cbe7)] [background-image:radial-gradient(var(--palette-fff8)_1px,transparent_1px)] [background-size:16px_16px]",
  ocean: "bg-[var(--palette-b6dbe0)] [background-image:linear-gradient(135deg,var(--palette-ffffff28)_25%,transparent_25%,transparent_50%,var(--palette-ffffff28)_50%,var(--palette-ffffff28)_75%,transparent_75%,transparent)] [background-size:24px_24px]",
};

export function MotivationBoard() {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const timers = useRef(new Map<string, number>());
  const pendingPatches = useRef(new Map<string, Partial<BoardNote>>());
  const imagePicker = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [theme, setTheme] = useState<ThemeName>("cork");
  const [listView, setListView] = useState(false);
  const [quote, setQuote] = useState(quoteOfTheDay());
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [wobbleId, setWobbleId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["motivation-board"], queryFn: () => apiRequest<BoardData>("/api/v1/notes") });
  const notes = useMemo(() => orderByBoardLayer(query.data?.notes ?? []), [query.data?.notes]);
  const Pet = PET_COMPONENTS.cat;

  function setLocal(id: string, patch: Partial<BoardNote>) {
    queryClient.setQueryData<BoardData>(["motivation-board"], (current) => current ? { ...current, notes: current.notes.map((note) => note.id === id ? { ...note, ...patch } : note) } : current);
  }
  function scheduleSave(id: string, patch: Partial<BoardNote>) {
    setError(""); setLocal(id, patch);
    pendingPatches.current.set(id, { ...pendingPatches.current.get(id), ...patch });
    const current = timers.current.get(id);
    if (current) window.clearTimeout(current);
    const timer = window.setTimeout(() => {
      timers.current.delete(id);
      const merged = pendingPatches.current.get(id) ?? patch;
      pendingPatches.current.delete(id);
      void apiRequest<{ note: BoardNote }>(`/api/v1/notes/${id}`, { method: "PATCH", body: JSON.stringify(merged) })
        .then(({ note }) => { setLocal(id, note); if (merged.zIndex !== undefined) void queryClient.invalidateQueries({ queryKey: ["motivation-board"] }); })
        .catch(() => { setError("That board change couldn’t be saved. Your board is refreshing."); void queryClient.invalidateQueries({ queryKey: ["motivation-board"] }); });
    }, 450);
    timers.current.set(id, timer);
  }
  async function addNote(kind: "STICKY" | "PAPER", values?: { quote?: string; attribution?: string; fileId?: string; imageUrl?: string; thumbnailUrl?: string | null }) {
    setError(""); setBusy(true);
    const zIndex = Math.max(0, ...notes.map((note) => note.zIndex)) + 1;
    const noteInput = { kind, text: kind === "STICKY" ? "A little progress is still progress." : "", quote: values?.quote ?? (kind === "PAPER" ? "Make room for what matters." : null), attribution: values?.attribution ?? (kind === "PAPER" ? "HabitHop" : null), fileId: values?.fileId ?? null, color: "lemon", paperStyle: "lined", x: 5 + notes.length % 5 * 3, y: 5 + notes.length % 5 * 3, width: 24, height: 28, rotation: (notes.length % 5 - 2) * 2, zIndex, pinned: false };
    try {
      const result = await apiRequest<{ note: BoardNote }>("/api/v1/notes", { method: "POST", body: JSON.stringify(noteInput) });
      queryClient.setQueryData<BoardData>(["motivation-board"], (current) => ({ notes: [...(current?.notes ?? []), { ...result.note, imageUrl: values?.imageUrl ?? result.note.imageUrl, thumbnailUrl: values?.thumbnailUrl ?? result.note.thumbnailUrl }], favorites: current?.favorites ?? [] }));
      setWobbleId(result.note.id); emitGameEvent("note-saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your board item could not be saved."); }
    finally { setBusy(false); }
  }
  async function removeNote(note: BoardNote) {
    const before = query.data;
    queryClient.setQueryData<BoardData>(["motivation-board"], (current) => current ? { ...current, notes: current.notes.filter((row) => row.id !== note.id) } : current);
    try { await apiRequest(`/api/v1/notes/${note.id}`, { method: "DELETE" }); }
    catch { queryClient.setQueryData(["motivation-board"], before); setError("That item couldn’t be deleted. Please try again."); }
  }
  async function duplicateNote(note: BoardNote) {
    try {
      const duplicate = await apiRequest<{ note: BoardNote }>("/api/v1/notes", { method: "POST", body: JSON.stringify({ kind: note.kind, text: note.text, quote: note.quote, attribution: note.attribution, fileId: note.fileId, color: note.color, paperStyle: note.paperStyle, ...clampBoardPosition({ x: note.x + 4, y: note.y + 4, width: note.width, height: note.height, rotation: note.rotation, zIndex: Math.max(...notes.map((row) => row.zIndex)) + 1 }), pinned: false }) });
      queryClient.setQueryData<BoardData>(["motivation-board"], (current) => current ? { ...current, notes: [...current.notes, { ...duplicate.note, imageUrl: note.imageUrl, thumbnailUrl: note.thumbnailUrl }] } : current);
      setWobbleId(duplicate.note.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That item could not be copied."); }
  }
  async function pinQuote(value = quote) {
    await addNote("PAPER", value);
  }
  async function favoriteQuote(value = quote) {
    try {
      const favorite = await apiRequest<Favorite>("/api/v1/notes/favorites", { method: "POST", body: JSON.stringify(value) });
      queryClient.setQueryData<BoardData>(["motivation-board"], (current) => current ? { ...current, favorites: [favorite, ...current.favorites.filter((item) => item.id !== favorite.id)] } : current);
    } catch { setError("That quote couldn’t be saved to your favorites."); }
  }
  async function removeFavorite(id: string) {
    const before = query.data;
    queryClient.setQueryData<BoardData>(["motivation-board"], (current) => current ? { ...current, favorites: current.favorites.filter((item) => item.id !== id) } : current);
    try { await apiRequest("/api/v1/notes/favorites", { method: "DELETE", body: JSON.stringify({ id }) }); }
    catch { queryClient.setQueryData(["motivation-board"], before); setError("That favorite couldn’t be removed."); }
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) { setError("Choose a JPG, PNG, WebP, or GIF image up to 10 MB."); return; }
    setError(""); setBusy(true); setUploadProgress(0);
    try {
      const presigned = await apiRequest<{ key: string; url: string; requiredHeaders: Record<string, string> }>("/api/v1/motivation/uploads/presign", { method: "POST", body: JSON.stringify({ mimeType: file.type, size: file.size, purpose: "motivation" }) });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhrRef.current = xhr; xhr.open("PUT", presigned.url);
        Object.entries(presigned.requiredHeaders).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round(event.loaded / event.total * 85)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Image upload didn’t finish. Please try again."));
        xhr.onerror = () => reject(new Error("Image upload connection failed.")); xhr.onabort = () => reject(new Error("Image upload canceled.")); xhr.send(file);
      });
      const confirmed = await apiRequest<{ file: { id: string }; url: string; thumbnailUrl: string | null }>("/api/v1/uploads/confirm", { method: "POST", body: JSON.stringify({ key: presigned.key }) });
      setUploadProgress(100); await addNote("PAPER", { quote: quote.quote, attribution: quote.author, fileId: confirmed.file.id, imageUrl: confirmed.url, thumbnailUrl: confirmed.thumbnailUrl });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The image couldn’t be uploaded."); }
    finally { xhrRef.current = null; setBusy(false); }
  }

  function beginGesture(event: ReactPointerEvent<HTMLElement>, note: BoardNote, action: Gesture["action"]) {
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { id: note.id, action, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, initial: { x: note.x, y: note.y, width: note.width, height: note.height }, last: {} };
  }
  function moveGesture(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current; const rect = boardRef.current?.getBoundingClientRect();
    if (!gesture || !rect || gesture.pointerId !== event.pointerId) return;
    const dx = (event.clientX - gesture.startX) / rect.width * 100; const dy = (event.clientY - gesture.startY) / rect.height * 100;
    const position = gesture.action === "move"
      ? clampBoardPosition({ ...gesture.initial, x: gesture.initial.x + dx, y: gesture.initial.y + dy, rotation: notes.find((note) => note.id === gesture.id)?.rotation ?? 0, zIndex: notes.find((note) => note.id === gesture.id)?.zIndex ?? 1 })
      : clampBoardPosition({ ...gesture.initial, x: gesture.initial.x, y: gesture.initial.y, width: gesture.initial.width + dx, height: gesture.initial.height + dy, rotation: notes.find((note) => note.id === gesture.id)?.rotation ?? 0, zIndex: notes.find((note) => note.id === gesture.id)?.zIndex ?? 1 });
    gesture.last = { x: position.x, y: position.y, width: position.width, height: position.height };
    setLocal(gesture.id, gesture.last);
  }
  function endGesture(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (Object.keys(gesture.last).length) { scheduleSave(gesture.id, gesture.last); setWobbleId(gesture.id); }
  }
  function onItemKeyDown(event: KeyboardEvent<HTMLElement>, note: BoardNote) {
    if (event.target instanceof HTMLElement && ["TEXTAREA", "INPUT", "SELECT"].includes(event.target.tagName)) return;
    const amount = event.shiftKey ? 5 : 1;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); void removeNote(note); }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault(); const next = clampBoardPosition({ x: note.x + (event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0), y: note.y + (event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0), width: note.width, height: note.height, rotation: note.rotation, zIndex: note.zIndex }); scheduleSave(note.id, { x: next.x, y: next.y });
    }
  }
  async function bringToFront(note: BoardNote) { const zIndex = Math.max(0, ...notes.map((row) => row.zIndex)) + 1; scheduleSave(note.id, { zIndex: Math.min(1000, zIndex) }); }

  if (query.isPending) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-32" /><Skeleton className="h-[36rem]" /></div>;
  if (query.isError) return <EmptyState title="Your board is taking a breather" description="We couldn’t load your notes. Please refresh and try again." pet={<Pet mood="idle" size={88} />} />;
  return <main className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-bold uppercase tracking-wider text-purple-foreground">Make a little space for good things</p><h1 className="font-heading text-3xl font-bold sm:text-4xl">Motivation Corner</h1><p className="mt-1 text-ink/75">A board for reminders, bright ideas, and kind words.</p></div><span className="rounded-full border-2 border-border bg-card px-4 py-2 font-bold">{notes.length} / 100 items</span></header>
    <Card className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-3xl border-2 border-border bg-gradient-to-br from-[var(--palette-fff3b0)] via-[var(--palette-ffe1e9)] to-[var(--palette-dff3ff)] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-ink/80">Quote of the day</p><blockquote className="mt-2 font-heading text-xl font-bold leading-snug">“{quote.quote}”</blockquote><p className="mt-2 text-sm font-bold">— {quote.author}</p></div><span className="text-4xl" aria-hidden="true">🌼</span></div><div className="mt-4 flex flex-wrap gap-2"><ChunkyButton size="sm" onClick={() => void pinQuote()}>📌 Pin to board</ChunkyButton><ChunkyButton size="sm" variant="secondary" onClick={() => setQuote(MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)]!)}>🔀 Shuffle quote</ChunkyButton><ChunkyButton size="sm" variant="ghost" onClick={() => void favoriteQuote()}>♡ Save quote</ChunkyButton></div></div>
      <div><h2 className="font-heading text-xl font-bold">Your favorite quotes</h2>{query.data?.favorites.length ? <ul className="mt-2 grid max-h-40 gap-2 overflow-auto">{query.data.favorites.map((favorite) => <li key={favorite.id} className="flex items-center justify-between gap-2 rounded-2xl bg-canvas p-3"><p className="min-w-0 text-sm">“{favorite.quote}” <span className="font-bold">— {favorite.author}</span></p><div className="flex shrink-0 gap-1"><button className="rounded-xl p-2 font-bold text-sky-foreground underline" onClick={() => void pinQuote({ quote: favorite.quote, author: favorite.author })} aria-label="Pin favorite quote to board">Pin</button><button className="rounded-xl p-2 font-bold text-coral-foreground underline" onClick={() => void removeFavorite(favorite.id)} aria-label="Remove favorite quote">Remove</button></div></li>)}</ul> : <p className="mt-2 rounded-2xl bg-canvas p-4 text-sm text-ink/80">Save a quote you love and it’ll be waiting here.</p>}</div>
    </Card>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><ChunkyButton disabled={busy || notes.length >= 100} onClick={() => void addNote("STICKY")}>＋ Add sticky</ChunkyButton><ChunkyButton variant="secondary" disabled={busy || notes.length >= 100} onClick={() => void addNote("PAPER")}>＋ Add themed paper</ChunkyButton><input ref={imagePicker} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Choose a board paper image" onChange={(event) => { void uploadImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /><ChunkyButton variant="ghost" disabled={busy || notes.length >= 100} onClick={() => imagePicker.current?.click()}>＋ Add image paper</ChunkyButton></div><div className="flex items-center gap-2"><label className="font-bold" htmlFor="board-theme">Board</label><select id="board-theme" value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)} className="min-h-11 rounded-xl border-2 border-border bg-card px-3"><option value="cork">Cork</option><option value="pastel">Pastel</option><option value="lavender">Lavender</option><option value="ocean">Ocean</option></select><button type="button" className="min-h-11 rounded-xl border-2 border-border bg-card px-3 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky" aria-pressed={listView} onClick={() => setListView((value) => !value)}>{listView ? "Board view" : "List view"}</button></div></div>
    {busy && uploadProgress > 0 && <ProgressBar label="Uploading image paper" value={uploadProgress} />}
    {error && <Toast tone="error" message={error} />}
    {notes.length === 0 ? <Card><EmptyState title="Your board is a blank page" description="Pin today’s quote or add a sticky note to make this space yours." pet={<Pet mood="happy" size={116} />} /></Card> : listView ? <AccessibleList notes={notes} onMove={(note, x, y) => scheduleSave(note.id, { x, y })} onDelete={removeNote} onFront={bringToFront} /> : <div className="overflow-x-auto rounded-[2.3rem]"><section aria-label="Motivation board" ref={boardRef} className={`relative min-h-[44rem] min-w-[680px] overflow-hidden rounded-[2rem] border-[8px] border-[var(--palette-744d30)] p-3 shadow-[inset_0_2px_14px_var(--palette-0003),0_8px_0_var(--palette-4f3724)] sm:min-w-0 sm:min-h-[48rem] ${themeStyles[theme]}`}>
      {notes.map((note) => <m.article key={note.id} tabIndex={0} aria-label={`${note.kind === "STICKY" ? "Sticky note" : "Themed paper"}: ${(note.kind === "STICKY" ? note.text : note.quote ?? note.text).slice(0, 60)}`} onKeyDown={(event) => onItemKeyDown(event, note)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className={`absolute flex min-w-0 flex-col overflow-visible rounded-sm p-3 shadow-[2px_5px_10px_var(--palette-0003)] outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-sky ${note.kind === "STICKY" ? "border-t-4 border-black/10" : `border border-black/10 ${paperTextures[note.paperStyle]}`}`} style={{ left: `${note.x}%`, top: `${note.y}%`, width: `${note.width}%`, height: `${note.height}%`, zIndex: note.zIndex, transform: `rotate(${note.rotation}deg)`, backgroundColor: note.kind === "STICKY" ? pastelSwatches[note.color] : note.paperStyle === "kraft" ? "var(--palette-ddc49c)" : undefined }} initial={reduceMotion ? false : { opacity: 0, scale: .88, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0, ...(wobbleId === note.id && !reduceMotion ? { rotate: [note.rotation - 2, note.rotation + 2, note.rotation] } : {}) }} onAnimationComplete={() => { if (wobbleId === note.id) setWobbleId(null); }}>
        {note.paperStyle === "washi" && note.kind === "PAPER" && <span aria-hidden="true" className="absolute -top-3 left-1/3 h-6 w-16 -rotate-6 bg-[var(--palette-fff9d6)]/80 shadow-sm" />}
        <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-1"><button type="button" className="min-h-8 flex-1 cursor-grab touch-none truncate text-left text-xs font-extrabold uppercase tracking-wide text-ink/80 active:cursor-grabbing" aria-label="Drag to move note; arrow keys also move it" onPointerDown={(event) => beginGesture(event, note, "move")}>{note.kind === "STICKY" ? "Sticky note" : note.paperStyle === "polaroid" ? "Little moment" : "Paper note"}</button><button type="button" className="rounded-lg px-1 font-bold" aria-label={note.pinned ? "Unpin item" : "Pin item"} aria-pressed={note.pinned} onClick={() => scheduleSave(note.id, { pinned: !note.pinned })}>{note.pinned ? "📌" : "⌖"}</button></div>
        {note.imageUrl && <div className={`relative my-2 min-h-12 flex-1 overflow-hidden ${note.paperStyle === "polaroid" ? "bg-white p-1 pb-5" : "rounded-lg"}`}><Image unoptimized fill src={note.thumbnailUrl ?? note.imageUrl} alt="Uploaded inspiration for this paper" className="object-cover" /></div>}
        <textarea aria-label={note.kind === "STICKY" ? "Edit sticky note text" : "Edit paper quote"} maxLength={note.kind === "STICKY" ? 1200 : 400} value={note.kind === "STICKY" ? note.text : note.quote ?? note.text} onChange={(event) => setLocal(note.id, note.kind === "STICKY" ? { text: event.target.value } : { quote: event.target.value })} onBlur={(event) => scheduleSave(note.id, note.kind === "STICKY" ? { text: event.currentTarget.value } : { quote: event.currentTarget.value })} className={`min-h-0 w-full flex-1 resize-none bg-transparent p-1 font-heading text-base font-bold leading-snug text-[var(--palette-3c3c3c)] placeholder:text-[var(--palette-3c3c3c)]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky ${note.paperStyle === "lined" ? "[background:repeating-linear-gradient(transparent_0_26px,var(--palette-91b9cf)_27px_28px)]" : ""}`} placeholder={note.kind === "STICKY" ? "Write a kind reminder…" : "Write a quote…"} />
        {note.kind === "PAPER" && <div className="mt-1 flex items-center justify-between gap-1"><input aria-label="Quote attribution" maxLength={120} value={note.attribution ?? ""} onChange={(event) => setLocal(note.id, { attribution: event.target.value })} onBlur={(event) => scheduleSave(note.id, { attribution: event.currentTarget.value })} placeholder="Attribution" className="w-2/3 bg-transparent text-xs font-bold text-[var(--palette-3c3c3c)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky" /><select aria-label="Paper style" value={note.paperStyle} onChange={(event) => scheduleSave(note.id, { paperStyle: event.target.value as PaperStyle })} className="max-w-20 rounded bg-white/70 text-xs text-[var(--palette-3c3c3c)]"><option value="lined">Lined</option><option value="grid">Grid</option><option value="kraft">Kraft</option><option value="pastel">Pastel</option><option value="washi">Washi</option><option value="polaroid">Polaroid</option></select></div>}
        {note.kind === "STICKY" && <select aria-label="Sticky note colour" value={note.color} onChange={(event) => scheduleSave(note.id, { color: event.target.value as Color })} className="mt-1 w-full rounded bg-white/65 text-xs text-[var(--palette-3c3c3c)]">{Object.keys(pastelSwatches).map((color) => <option key={color} value={color}>{color}</option>)}</select>}
        <div className="mt-2 flex flex-wrap justify-end gap-1"><button type="button" className="rounded-lg bg-white/50 px-1.5 py-1 text-xs font-bold text-[var(--palette-3c3c3c)]" aria-label="Rotate left" onClick={() => scheduleSave(note.id, { rotation: Math.max(-15, note.rotation - 5) })}>↶</button><button type="button" className="rounded-lg bg-white/50 px-1.5 py-1 text-xs font-bold text-[var(--palette-3c3c3c)]" aria-label="Rotate right" onClick={() => scheduleSave(note.id, { rotation: Math.min(15, note.rotation + 5) })}>↷</button><button type="button" className="rounded-lg bg-white/50 px-1.5 py-1 text-xs font-bold text-[var(--palette-3c3c3c)]" onClick={() => void bringToFront(note)}>Front</button><button type="button" className="rounded-lg bg-white/50 px-1.5 py-1 text-xs font-bold text-[var(--palette-3c3c3c)]" aria-label="Duplicate item" onClick={() => void duplicateNote(note)}>⧉</button><button type="button" className="rounded-lg bg-white/70 px-1.5 py-1 text-xs font-bold text-[var(--palette-b52d2d)]" aria-label="Delete item" onClick={() => void removeNote(note)}>×</button></div>
        <button type="button" aria-label="Resize item" onPointerDown={(event) => beginGesture(event, note, "resize")} className="absolute -bottom-2 -right-2 grid h-7 w-7 cursor-nwse-resize touch-none place-items-center rounded-full border-2 border-white bg-sky text-white shadow">↘</button>
      </m.article>)}
    </section></div>}
    <div className="flex items-center gap-3 rounded-3xl border-2 border-border bg-card p-4"><Pet mood="happy" size={64} /><p className="rounded-2xl bg-canvas px-4 py-3 text-sm font-bold">A reminder can be a tiny lantern for later. Keep the ones that feel like you.</p></div>
  </main>;
}

function AccessibleList({ notes, onMove, onDelete, onFront }: { notes: BoardNote[]; onMove: (note: BoardNote, x: number, y: number) => void; onDelete: (note: BoardNote) => void; onFront: (note: BoardNote) => void }) {
  return <Card><h2 className="font-heading text-xl font-bold">Board items · accessible list</h2><ul className="mt-3 grid gap-3">{notes.map((note) => <li key={note.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-border p-3"><div><p className="font-bold">{note.kind === "STICKY" ? note.text : note.quote || note.text}</p><p className="text-sm text-ink/80">{note.kind} · position {Math.round(note.x)}%, {Math.round(note.y)}% {note.pinned ? "· pinned" : ""}</p></div><div className="flex flex-wrap gap-1"><button className="min-h-10 rounded-xl border px-3 font-bold" onClick={() => onMove(note, Math.max(0, note.x - 2), note.y)} aria-label="Move item left">←</button><button className="min-h-10 rounded-xl border px-3 font-bold" onClick={() => onMove(note, Math.min(100 - note.width, note.x + 2), note.y)} aria-label="Move item right">→</button><button className="min-h-10 rounded-xl border px-3 font-bold" onClick={() => onMove(note, note.x, Math.max(0, note.y - 2))} aria-label="Move item up">↑</button><button className="min-h-10 rounded-xl border px-3 font-bold" onClick={() => onMove(note, note.x, Math.min(100 - note.height, note.y + 2))} aria-label="Move item down">↓</button><button className="min-h-10 rounded-xl border px-3 font-bold" onClick={() => onFront(note)}>Bring to front</button><button className="min-h-10 rounded-xl border border-coral px-3 font-bold text-coral-foreground" onClick={() => onDelete(note)}>Delete</button></div></li>)}</ul></Card>;
}


