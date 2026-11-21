"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { z } from "zod";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { emitGameEvent } from "@/lib/game-events";
import { initializeSound } from "@/lib/sound";
import { Card, ChunkyButton, Confetti, EmptyState, Input, Modal, Skeleton, Tag, Toast } from "@/components/ui";
import { HopPet } from "@/components/pets/HopPet";
import { MediaUploader, type UploadedMedia } from "@/components/story/MediaUploader";

type Memory = {
  id: string; title: string; story: string; tags: string[]; occurredAt: string; mood: string | null;
  sourceUrl: string | null; mediaFileId: string | null; posterFileId: string | null; mediaType: "image" | "video" | "youtube" | "vimeo" | "link";
  mimeType: string | null; mediaUrl: string | null; thumbnailUrl: string | null; posterUrl: string | null; embedUrl: string | null; createdAt: string; updatedAt: string;
};
type MemoryPage = { items: Memory[]; nextCursor: string | null };
type Filters = { q: string; tag: string; mood: string; from: string; to: string };
type MemoryBody = { title: string; story: string; tags: string[]; occurredAt: string; mood: string | null; sourceUrl: string | null; mediaFileId: string | null; posterFileId: string | null };
type SaveResult = { memory: Memory; unlockedBadges?: { key: string; title: string }[] };
const moods = ["🌱", "😊", "🎉", "📚", "🏞️", "🍰", "💛", "💪", "😌", "✨"];
const formSchema = z.object({ title: z.string().trim().min(1, "Add a title.").max(120), story: z.string().max(8000), occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."), sourceUrl: z.string().trim().refine((value) => !value || isWebUrl(value), "Use a valid HTTP or HTTPS URL.") });

export function StoryCorner() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ q: "", tag: "", mood: "", from: "", to: "" });
  const [search, setSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [composer, setComposer] = useState<Memory | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [badgeNotice, setBadgeNotice] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  const reducedMotion = useReducedMotion();
  const tagOptions = useQuery({ queryKey: ["memory-tags", tagSearch], queryFn: () => apiRequest<{ tags: string[] }>(`/api/v1/tags?q=${encodeURIComponent(tagSearch)}`) });
  useEffect(() => { const timeout = window.setTimeout(() => setFilters((value) => ({ ...value, q: search.trim() })), 250); return () => window.clearTimeout(timeout); }, [search]);
  const queryString = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [key, value])).toString(), [filters]);
  const feed = useInfiniteQuery({ queryKey: ["memories", queryString], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => apiRequest<MemoryPage>(`/api/v1/memories?${queryString}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`), getNextPageParam: (last) => last.nextCursor ?? undefined });
  const memories = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  const selectedIndex = memories.findIndex((memory) => memory.id === selectedId);
  const selected = selectedIndex >= 0 ? memories[selectedIndex] : null;
  const observerTarget = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = observerTarget.current;
    if (!element || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void fetchNextPage(); }, { rootMargin: "360px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && selectedIndex < memories.length - 1) { event.preventDefault(); setSelectedId(memories[selectedIndex + 1]?.id ?? null); }
      if (event.key === "ArrowLeft" && selectedIndex > 0) { event.preventDefault(); setSelectedId(memories[selectedIndex - 1]?.id ?? null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [memories, selected, selectedIndex]);

  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: MemoryBody }): Promise<SaveResult> => id ? apiRequest<SaveResult>(`/api/v1/memories/${id}`, { method: "PATCH", body: JSON.stringify(body) }) : apiRequest<SaveResult>("/api/v1/memories", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (result) => {
      setComposer(null); setNotice(""); setConfetti(true); window.setTimeout(() => setConfetti(false), 1800);
      initializeSound(); emitGameEvent("memory-saved", { message: "A lovely memory to keep." });
      if (result.unlockedBadges?.[0]) { const badge = result.unlockedBadges[0]; setBadgeNotice(badge.title); emitGameEvent("badge-unlock", { message: `You unlocked ${badge.title}!` }); }
      setTagSearch(""); void queryClient.invalidateQueries({ queryKey: ["memories"] }); void queryClient.invalidateQueries({ queryKey: ["memory-tags"] }); void queryClient.invalidateQueries({ queryKey: ["notifications"] }); void queryClient.invalidateQueries({ queryKey: ["achievements"] });
    },
    onError: (error) => { setNotice(errorMessage(error)); emitGameEvent("mistake"); },
  });
  const remove = useMutation({ mutationFn: (id: string) => apiRequest<{ id: string }>(`/api/v1/memories/${id}`, { method: "DELETE" }), onSuccess: () => { setSelectedId(null); void queryClient.invalidateQueries({ queryKey: ["memories"] }); }, onError: (error) => setNotice(errorMessage(error)) });

  return <div className="space-y-5 sm:space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-extrabold tracking-[.14em] text-primary-foreground">YOUR STORY CORNER</p><h1 className="font-heading text-3xl font-bold sm:text-4xl">Keep the little moments</h1><p className="mt-1 text-ink/80">A private place for the days you want to remember.</p></div><ChunkyButton onClick={() => { setNotice(""); setComposer("new"); }}>＋ Save a memory</ChunkyButton></header>
    {notice && <Toast tone="error" message={notice} />}
    <Card className="p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="grid gap-1 text-xs font-bold lg:col-span-2">Search memories<Input aria-label="Search memories" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="A place, a person, a feeling…" /></label><label className="grid gap-1 text-xs font-bold">Tag<select aria-label="Filter by tag" className="min-h-12 rounded-2xl border-2 border-border bg-card px-3 text-sm" value={filters.tag} onChange={(event) => setFilters((value) => ({ ...value, tag: event.target.value }))}><option value="">All tags</option>{(tagOptions.data?.tags ?? []).map((tag) => <option value={tag} key={tag}>#{tag}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Mood<select aria-label="Filter by mood" className="min-h-12 rounded-2xl border-2 border-border bg-card px-3 text-sm" value={filters.mood} onChange={(event) => setFilters((value) => ({ ...value, mood: event.target.value }))}><option value="">Any mood</option>{moods.map((mood) => <option value={mood} key={mood}>{mood}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs font-bold">From<input aria-label="From date" type="date" className="min-h-12 min-w-0 rounded-2xl border-2 border-border bg-card px-2" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} /></label><label className="grid gap-1 text-xs font-bold">To<input aria-label="To date" type="date" className="min-h-12 min-w-0 rounded-2xl border-2 border-border bg-card px-2" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} /></label></div></div></Card>
    {feed.isPending ? <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">{[0, 1, 2, 3, 4, 5].map((index) => <Skeleton className="mb-5 h-72 break-inside-avoid" key={index} />)}</div> : feed.isError ? <Card><EmptyState pet={<HopPet size={72} />} title="Your memories are safe" description="We couldn’t open your story corner right now." /><div className="mt-4 text-center"><ChunkyButton onClick={() => void feed.refetch()}>Try again</ChunkyButton></div></Card> : memories.length === 0 ? <Card><EmptyState pet={<HopPet size={82} />} title="Every good story starts small" description="Save a photo, a video, or a link to a moment you want to keep." /><div className="mt-4 text-center"><ChunkyButton onClick={() => setComposer("new")}>Save your first memory</ChunkyButton></div></Card> : <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">{memories.map((memory) => <MemoryCard key={memory.id} memory={memory} reducedMotion={Boolean(reducedMotion)} onOpen={() => setSelectedId(memory.id)} onEdit={() => setComposer(memory)} onDelete={() => { if (window.confirm(`Delete “${memory.title}”?`)) remove.mutate(memory.id); }} />)}</div>}
    <div ref={observerTarget} aria-hidden="true" className="h-4" />
    {feed.isFetchingNextPage && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>}
    {feed.isFetchNextPageError && <div className="text-center"><ChunkyButton variant="ghost" onClick={() => void feed.fetchNextPage()}>Load more</ChunkyButton></div>}
    <MemoryComposer key={composer === "new" ? "new" : composer?.id ?? "closed"} open={composer !== null} memory={composer === "new" ? null : composer} suggestions={tagOptions.data?.tags ?? []} saving={save.isPending} error={save.isError ? errorMessage(save.error) : ""} onTagSearch={setTagSearch} onClose={() => { if (!save.isPending) { setComposer(null); save.reset(); } }} onSave={(body) => save.mutate({ id: composer && composer !== "new" ? composer.id : undefined, body })} />
    <Lightbox memory={selected} onClose={() => setSelectedId(null)} onNext={() => selectedIndex < memories.length - 1 && setSelectedId(memories[selectedIndex + 1]?.id ?? null)} onPrevious={() => selectedIndex > 0 && setSelectedId(memories[selectedIndex - 1]?.id ?? null)} />
    {confetti && <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center" aria-live="polite"><div className="rounded-2xl border-2 border-primary/30 bg-card px-4 shadow-card"><Confetti /><span className="sr-only">Memory saved.</span></div></div>}
    {badgeNotice && <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-4" role="status" aria-live="polite"><div className="relative w-full max-w-sm rounded-[2rem] border-4 border-sun bg-card p-8 text-center shadow-card"><Confetti /><div className="mb-3 text-6xl" aria-hidden="true">🏅</div><p className="text-xs font-extrabold uppercase tracking-wider text-ink/80">Achievement unlocked</p><p className="font-heading text-2xl font-bold">{badgeNotice}</p><ChunkyButton className="mt-5" onClick={() => setBadgeNotice(null)}>Keep hopping</ChunkyButton></div></div>}
  </div>;
}

function MemoryCard({ memory, reducedMotion, onOpen, onEdit, onDelete }: { memory: Memory; reducedMotion: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const degrees = (([...memory.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5) - 2) * .55;
  return <m.article layout={!reducedMotion} whileHover={reducedMotion ? undefined : { rotate: degrees + (degrees < 0 ? -1.2 : 1.2), y: -3 }} style={{ rotate: degrees }} className="mb-5 break-inside-avoid rounded-md bg-white p-3 pb-4 shadow-[0_8px_28px_rgba(37,49,54,.14)] ring-1 ring-black/5">
    <button type="button" onClick={onOpen} className="block w-full text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky">
      <MediaPreview memory={memory} compact />
      <div className="px-1 pt-3"><div className="flex items-start justify-between gap-2"><h2 className="font-heading text-lg font-bold text-[var(--palette-263238)]">{memory.title}</h2><span className="text-xl" aria-label={memory.mood ?? undefined}>{memory.mood}</span></div><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-[var(--palette-526166)]">{memory.story}</p><p className="mt-2 text-xs font-bold text-[var(--palette-66777d)]">{new Date(`${memory.occurredAt}T12:00:00`).toLocaleDateString()}</p><div className="mt-2 flex flex-wrap gap-1.5">{memory.tags.map((tag) => <Tag key={tag} tone="blue">#{tag}</Tag>)}</div></div>
    </button>
    <div className="mt-3 flex justify-end gap-3 border-t border-[var(--palette-e9edf0)] pt-2"><button type="button" onClick={onEdit} className="min-h-9 rounded-lg px-2 text-xs font-bold text-[var(--palette-344249)] underline">Edit</button><button type="button" onClick={onDelete} className="min-h-9 rounded-lg px-2 text-xs font-bold text-coral-foreground underline">Delete</button></div>
  </m.article>;
}

function MediaPreview({ memory, compact = false }: { memory: Memory; compact?: boolean }) {
  const className = compact ? "max-h-80 w-full rounded-sm object-cover" : "max-h-[60vh] max-w-full rounded-xl object-contain";
  if (memory.embedUrl) return <iframe title={`${memory.mediaType} memory video`} src={memory.embedUrl} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" referrerPolicy="no-referrer" allowFullScreen className={`w-full ${compact ? "aspect-video" : "aspect-video max-h-[60vh]"}`} />;
  if (memory.mediaType === "video" && memory.mediaUrl) return <video src={memory.mediaUrl} poster={memory.posterUrl ?? undefined} controls preload="metadata" className={compact ? "max-h-80 w-full rounded-sm object-cover" : "max-h-[60vh] max-w-full rounded-xl"} onClick={(event) => event.stopPropagation()} />;
  if (memory.mediaType === "image" && memory.mediaUrl) return <Image unoptimized width={1200} height={900} src={compact ? memory.thumbnailUrl ?? memory.mediaUrl : memory.mediaUrl} alt={memory.title} referrerPolicy="no-referrer" loading={compact ? "lazy" : "eager"} className={className} />;
  if (memory.mediaUrl) return <a href={memory.mediaUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={(event) => event.stopPropagation()} className="grid aspect-video place-items-center rounded-2xl bg-canvas p-5 text-center font-bold text-sky-foreground underline">↗ Open saved link</a>;
  return <div className="grid aspect-video place-items-center rounded-2xl bg-canvas text-4xl" aria-hidden="true">📎</div>;
}

function Lightbox({ memory, onClose, onPrevious, onNext }: { memory: Memory | null; onClose: () => void; onPrevious: () => void; onNext: () => void }) {
  const start = useRef<number | null>(null);
  return <Modal open={Boolean(memory)} onClose={onClose} title={memory?.title ?? "Memory"}>{memory && <div onTouchStart={(event) => { start.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (start.current === null) return; const delta = (event.changedTouches[0]?.clientX ?? start.current) - start.current; if (Math.abs(delta) > 60) { if (delta > 0) onPrevious(); else onNext(); } start.current = null; }} className="space-y-4">
    <div className="flex items-center justify-between gap-3"><ChunkyButton size="sm" variant="ghost" disabled={!memory} onClick={onPrevious} aria-label="Previous memory">← Previous</ChunkyButton><span className="text-xs font-bold text-ink/80">Use ← and → keys or swipe</span><ChunkyButton size="sm" variant="ghost" onClick={onNext} aria-label="Next memory">Next →</ChunkyButton></div>
    <div className="grid min-h-40 place-items-center"><MediaPreview memory={memory} /></div>
    <div className="flex flex-wrap items-center gap-2"><span className="text-xl">{memory.mood}</span><span className="text-sm font-bold text-ink/80">{new Date(`${memory.occurredAt}T12:00:00`).toLocaleDateString()}</span>{memory.tags.map((tag) => <Tag key={tag}>#{tag}</Tag>)}</div>
    <p className="max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed">{memory.story}</p>
  </div>}</Modal>;
}

function MemoryComposer({ open, memory, suggestions, saving, error, onTagSearch, onClose, onSave }: { open: boolean; memory: Memory | null; suggestions: string[]; saving: boolean; error: string; onTagSearch: (value: string) => void; onClose: () => void; onSave: (body: MemoryBody) => void }) {
  const [title, setTitle] = useState(memory?.title ?? "");
  const [story, setStory] = useState(memory?.story ?? "");
  const [date, setDate] = useState(memory?.occurredAt ?? localDateInput());
  const [mood, setMood] = useState(memory?.mood ?? moods[0]!);
  const [url, setUrl] = useState(memory?.sourceUrl ?? "");
  const [media, setMedia] = useState<UploadedMedia | null>(memory?.mediaFileId && memory.mediaUrl && memory.mimeType ? { id: memory.mediaFileId, mimeType: memory.mimeType, size: 0, url: memory.mediaUrl, thumbnailUrl: memory.thumbnailUrl } : null);
  const [poster, setPoster] = useState<UploadedMedia | null>(memory?.posterFileId && memory.posterUrl ? { id: memory.posterFileId, mimeType: "image/webp", size: 0, url: memory.posterUrl, thumbnailUrl: null } : null);
  const [tags, setTags] = useState(memory?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [validationError, setValidationError] = useState("");
  const addTag = (candidate: string) => { const tag = candidate.trim().replace(/^#+/, "").toLocaleLowerCase(); if (tag && tag.length <= 32 && !tags.includes(tag) && tags.length < 12) setTags((value) => [...value, tag]); setTagInput(""); onTagSearch(""); };
  return <Modal open={open} onClose={onClose} title={memory ? "Edit memory" : "Save a memory"}><form className="max-h-[78vh] space-y-4 overflow-y-auto pr-1" onSubmit={(event) => { event.preventDefault(); const parsed = formSchema.safeParse({ title, story, occurredAt: date, sourceUrl: url }); if (!parsed.success) { setValidationError(parsed.error.issues[0]?.message ?? "Check the memory details."); return; } if (Boolean(parsed.data.sourceUrl) === Boolean(media)) { setValidationError("Add one upload or paste one URL."); return; } setValidationError(""); onSave({ title: parsed.data.title, story: parsed.data.story.replace(/\r\n?/g, "\n"), occurredAt: parsed.data.occurredAt, mood: mood || null, tags, sourceUrl: parsed.data.sourceUrl || null, mediaFileId: media?.id ?? null, posterFileId: poster?.id ?? null }); }}>
    <label className="grid gap-1.5 text-sm font-bold">Title<Input value={title} maxLength={120} required onChange={(event) => setTitle(event.target.value)} placeholder="A day by the lake" /></label>
    <label className="grid gap-1.5 text-sm font-bold">Story<textarea className="min-h-28 rounded-2xl border-2 border-border bg-card p-3 font-sans focus:border-sky focus:outline-none" value={story} maxLength={8000} onChange={(event) => setStory(event.target.value)} placeholder="What would you like to remember? Line breaks are kept." /></label>
    <MediaUploader value={media} poster={poster} onChange={(newMedia, newPoster) => { setMedia(newMedia); setPoster(newPoster); if (newMedia) setUrl(""); }} />
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-bold">Or paste a link<Input type="url" value={url} onChange={(event) => { const next = event.target.value; setUrl(next); if (next) { setMedia(null); setPoster(null); } }} placeholder="https://…" /></label><label className="grid gap-1.5 text-sm font-bold">Date<input type="date" required className="min-h-12 rounded-2xl border-2 border-border bg-card px-3" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-bold">Mood<select aria-label="Memory mood" className="min-h-12 rounded-2xl border-2 border-border bg-card px-3 text-lg" value={mood} onChange={(event) => setMood(event.target.value)}>{moods.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="relative grid gap-1.5 text-sm font-bold"><label htmlFor="memory-tag-input">Tags</label><Input id="memory-tag-input" value={tagInput} maxLength={32} onChange={(event) => { setTagInput(event.target.value); onTagSearch(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(tagInput); } }} placeholder="Type a tag, then Enter" />{tagInput && suggestions.filter((tag) => !tags.includes(tag)).length > 0 && <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-2xl border-2 border-border bg-card p-1 shadow-card">{suggestions.filter((tag) => !tags.includes(tag)).map((tag) => <button type="button" key={tag} onClick={() => addTag(tag)} className="block min-h-10 w-full rounded-xl px-3 text-left hover:bg-canvas">#{tag}</button>)}</div>}<div className="flex flex-wrap gap-1.5">{tags.map((tag) => <button type="button" key={tag} onClick={() => setTags((value) => value.filter((item) => item !== tag))} aria-label={`Remove tag ${tag}`}><Tag>#{tag} ×</Tag></button>)}</div></div>
    </div>
    {(validationError || error) && <Toast tone="error" message={validationError || error} />}
    <div className="flex justify-end gap-2"><ChunkyButton type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</ChunkyButton><ChunkyButton type="submit" disabled={saving}>{saving ? "Saving…" : memory ? "Save changes" : "Save memory"}</ChunkyButton></div>
  </form></Modal>;
}

function isWebUrl(raw: string) { try { const url = new URL(raw); return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password; } catch { return false; } }
function localDateInput() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function errorMessage(error: unknown) { return error instanceof ApiClientError ? error.message : "That didn’t save. Please try again."; }

