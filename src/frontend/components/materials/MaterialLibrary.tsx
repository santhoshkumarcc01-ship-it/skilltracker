"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { m, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { apiRequest, ApiClientError } from "@/frontend/lib/api-client";
import { emitGameEvent } from "@/frontend/lib/game-events";
import { initializeSound } from "@/frontend/lib/sound";
import { sanitizeNoteHtml } from "@/shared/sanitization/note-sanitizer";
import { Card, ChunkyButton, EmptyState, Input, Modal, Skeleton, Tag, Toast } from "@/frontend/components/ui";
import { HopPet } from "@/frontend/components/pets/HopPet";
import { MaterialFileUpload, type UploadedMaterialFile } from "@/frontend/components/materials/MaterialFileUpload";

type MaterialType = "NOTE" | "FILE" | "LINK" | "VIDEO";
type Material = { id: string; type: MaterialType; title: string; content: string; url: string | null; embedUrl: string | null; domain: string | null; folder: { id: string; name: string } | null; folderId: string | null; fileId: string | null; fileName: string | null; mimeType: string | null; size: number | null; downloadUrl: string | null; thumbnailUrl: string | null; tags: string[]; pinned: boolean; favourite: boolean; createdAt: string; updatedAt: string };
type Folder = { id: string; userId: string; parentId: string | null; name: string; color: string };
type MaterialPage = { items: Material[]; nextCursor: string | null; savedThisWeek: number; currentStreak: number };
type Draft = { type: MaterialType; title: string; content: string; url: string; folderId: string; file: UploadedMaterialFile | null; tags: string[] };
const types: { key: MaterialType | ""; title: string; icon: string }[] = [{ key: "", title: "All types", icon: "✨" }, { key: "NOTE", title: "Note", icon: "📝" }, { key: "FILE", title: "File", icon: "📄" }, { key: "LINK", title: "Link", icon: "🔗" }, { key: "VIDEO", title: "Video", icon: "🎬" }];

export function MaterialLibrary() {
  const client = useQueryClient();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<MaterialType | "">("");
  const [tag, setTag] = useState("");
  const [favourite, setFavourite] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"grid" | "list" | "timeline">("grid");
  const [grouping, setGrouping] = useState<"week" | "month">("week");
  const [editor, setEditor] = useState<Material | "new" | null>(null);
  const [reader, setReader] = useState<Material | null>(null);
  const [notice, setNotice] = useState("");
  const [badge, setBadge] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const queryText = useMemo(() => new URLSearchParams({ q: search, ...(type ? { type } : {}), ...(tag ? { tag } : {}), ...(favourite ? { favourite: "true" } : {}), ...(folderId ? { folderId } : {}), sort }).toString(), [search, type, tag, favourite, folderId, sort]);
  useEffect(() => { const id = window.setTimeout(() => setSearch(query.trim()), 250); return () => window.clearTimeout(id); }, [query]);
  const materialsQuery = useInfiniteQuery({ queryKey: ["materials", queryText], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => apiRequest<MaterialPage>(`/api/v1/materials?${queryText}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`), getNextPageParam: (last) => last.nextCursor ?? undefined });
  const foldersQuery = useQuery({ queryKey: ["material-folders"], queryFn: () => apiRequest<{ folders: Folder[] }>("/api/v1/folders") });
  const tagsQuery = useQuery({ queryKey: ["material-tags"], queryFn: () => apiRequest<{ tags: string[] }>("/api/v1/materials/tags").then((res) => res.tags) });
  const items = useMemo(() => materialsQuery.data?.pages.flatMap((page) => page.items) ?? [], [materialsQuery.data]);
  const pageSummary = materialsQuery.data?.pages[0];
  const grouped = useMemo(() => groupMaterials(items, grouping), [items, grouping]);
  const invalidate = () => { void client.invalidateQueries({ queryKey: ["materials"] }); void client.invalidateQueries({ queryKey: ["material-tags"] }); void client.invalidateQueries({ queryKey: ["material-folders"] }); };

  const save = useMutation({
    mutationFn: (draft: Draft) => {
      const body = { type: draft.type, title: draft.title, content: draft.type === "NOTE" ? sanitizeNoteHtml(draft.content) : draft.content, url: draft.url || null, folderId: draft.folderId || null, fileId: draft.file?.id ?? null, tags: draft.tags };
      const id = editor && editor !== "new" ? editor.id : null;
      return apiRequest<{ material: Material; unlockedBadges?: { key: string; title: string }[] }>(id ? `/api/v1/materials/${id}` : "/api/v1/materials", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
    },
    onSuccess: (result) => {
      const draftId = editor && editor !== "new" ? editor.id : "new";
      window.localStorage.removeItem(`habithop:material-note-draft:${draftId}`); setEditor(null); setNotice(""); invalidate();
      if (result.material.type === "NOTE") { initializeSound(); emitGameEvent("note-saved"); }
      const unlocked = result.unlockedBadges?.[0];
      if (unlocked) { setBadge(unlocked.title); emitGameEvent("badge-unlock", { message: `You unlocked ${unlocked.title}!` }); }
    },
    onError: (error) => { setNotice(errorMessage(error)); emitGameEvent("mistake"); },
  });
  const remove = useMutation({ mutationFn: (id: string) => apiRequest<{ id: string }>(`/api/v1/materials/${id}`, { method: "DELETE" }), onSuccess: () => { setReader(null); invalidate(); }, onError: (error) => setNotice(errorMessage(error)) });
  const folderCreate = useMutation({ mutationFn: (name: string) => apiRequest<{ folder: Folder }>("/api/v1/folders", { method: "POST", body: JSON.stringify({ name, parentId: folderId || null }) }), onSuccess: () => { setFolderDraft(""); invalidate(); } });
  const folderRename = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => apiRequest<{ folder: Folder }>(`/api/v1/folders/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }), onSuccess: invalidate });
  const folderRemove = useMutation({ mutationFn: (id: string) => apiRequest<{ id: string }>(`/api/v1/folders/${id}`, { method: "DELETE" }), onSuccess: invalidate });
  const toggle = useMutation({
    mutationFn: ({ item, field }: { item: Material; field: "pinned" | "favourite" }) => apiRequest(`/api/v1/materials/${item.id}`, { method: "PATCH", body: JSON.stringify({ [field]: !item[field] }) }),
    onMutate: async ({ item, field }) => { await client.cancelQueries({ queryKey: ["materials"] }); const previous = client.getQueryData<MaterialPage>(["materials", queryText]); if (previous) client.setQueryData<MaterialPage>(["materials", queryText], { ...previous, items: previous.items.map((entry) => entry.id === item.id ? { ...entry, [field]: !entry[field] } : entry) }); return { previous }; },
    onError: (_error, _variables, context) => { if (context?.previous) client.setQueryData(["materials", queryText], context.previous); emitGameEvent("mistake"); }, onSettled: invalidate,
  });

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-extrabold tracking-[.14em] text-primary-foreground">YOUR MATERIAL LIBRARY</p><h1 className="font-heading text-3xl font-bold sm:text-4xl">Keep what you learn</h1><p className="mt-1 text-ink/80">Notes, useful links, and resources in one cozy place.</p></div><ChunkyButton onClick={() => { save.reset(); setNotice(""); setEditor("new"); }}>＋ Add material</ChunkyButton></header>
    {notice && <Toast tone="error" message={notice} />}
    <Card className="grid gap-4 p-4 lg:grid-cols-[220px_1fr]">
      <aside aria-label="Folder tree" className="space-y-2 border-b-2 border-border pb-4 lg:border-b-0 lg:border-r-2 lg:pb-0 lg:pr-4"><div className="flex items-center justify-between"><h2 className="font-heading text-lg font-bold">Subjects</h2><button type="button" onClick={() => setFolderDraft((value) => value ? "" : " ")} aria-label="Add folder" className="min-h-9 min-w-9 rounded-xl font-bold hover:bg-canvas">＋</button></div>
        {folderDraft !== "" && <form className="flex gap-1" onSubmit={(event) => { event.preventDefault(); const name = folderDraft.trim(); if (name) folderCreate.mutate(name); }}><Input autoFocus aria-label="Folder name" value={folderDraft.trimStart()} onChange={(event) => setFolderDraft(event.target.value)} placeholder="New subject" /><button className="rounded-xl px-2 font-bold text-primary-foreground" aria-label="Save folder">✓</button></form>}
        <button type="button" onClick={() => { setFolderId(""); setTag(""); }} className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left font-bold ${!folderId ? "bg-primary/15" : "hover:bg-canvas"}`}>📚 All materials</button>
        {(foldersQuery.data?.folders ?? []).filter((folder) => !folder.parentId).map((folder) => <FolderBranch key={folder.id} folder={folder} all={foldersQuery.data?.folders ?? []} selected={folderId} onSelect={setFolderId} onRename={(target, name) => folderRename.mutate({ id: target, name })} onDelete={(target) => { if (window.confirm("Delete this subject and its nested folders? Materials will move to All materials.")) folderRemove.mutate(target); }} />)}
      </aside>
      <section className="min-w-0 space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_140px_140px_120px]"><label className="grid gap-1 text-xs font-bold sm:col-span-2 xl:col-span-1">Search your library<Input aria-label="Search materials" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, titles, tags…" /></label><label className="grid gap-1 text-xs font-bold">Type<select aria-label="Filter type" value={type} onChange={(event) => setType(event.target.value as MaterialType | "")} className="min-h-12 rounded-2xl border-2 border-border bg-card px-3">{types.map((item) => <option key={item.title} value={item.key}>{item.icon} {item.title}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Tag<select aria-label="Filter tag" value={tag} onChange={(event) => setTag(event.target.value)} className="min-h-12 rounded-2xl border-2 border-border bg-card px-3"><option value="">All tags</option>{(tagsQuery.data ?? []).map((item) => <option key={item} value={item}>#{item}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Sort<select aria-label="Sort materials" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-12 rounded-2xl border-2 border-border bg-card px-3"><option value="recent">Recently added</option><option value="updated">Recently updated</option><option value="oldest">Oldest</option><option value="title">Title A–Z</option></select></label></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><label className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold"><input type="checkbox" checked={favourite} onChange={(event) => setFavourite(event.target.checked)} className="size-5 accent-[var(--palette-58cc02)]" />♥ Favourites</label><div className="flex gap-1" role="group" aria-label="Material view">{(["grid", "list", "timeline"] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`min-h-10 rounded-xl px-3 text-sm font-bold capitalize ${view === mode ? "bg-primary/20" : "hover:bg-canvas"}`}>{mode === "timeline" ? "↕ Look back" : mode === "grid" ? "▦ Grid" : "☷ List"}</button>)}</div></div>
        {view === "timeline" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary/10 px-4 py-3"><p className="font-bold">You saved <strong>{pageSummary?.savedThisWeek ?? 0} materials</strong> this week{pageSummary?.currentStreak ? ` · ${pageSummary.currentStreak} day learning streak` : ""} 🌱</p><div className="flex gap-1" aria-label="Timeline grouping">{(["week", "month"] as const).map((unit) => <button type="button" key={unit} onClick={() => setGrouping(unit)} aria-pressed={grouping === unit} className={`min-h-9 rounded-xl px-3 text-xs font-bold capitalize ${grouping === unit ? "bg-card shadow" : ""}`}>{unit}</button>)}</div></div>}
        {materialsQuery.isPending ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((id) => <Skeleton key={id} className="h-52" />)}</div> : materialsQuery.isError ? <div><EmptyState pet={<HopPet size={70} />} title="Your library is still here" description="We couldn’t open it just now." /><div className="mt-3 text-center"><ChunkyButton variant="secondary" onClick={() => void materialsQuery.refetch()}>Try again</ChunkyButton></div></div> : items.length === 0 ? <EmptyState pet={<HopPet size={78} />} title="A good place to start" description="Save a note, resource, or link you want to find again." /> : view === "timeline" ? <div className="space-y-5">{grouped.map(([label, entries]) => <section key={label} className="space-y-3"><h2 className="sticky top-16 z-[1] rounded-xl bg-canvas/95 py-2 font-heading text-xl font-bold">{label}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{entries.map((item) => <MaterialCard key={item.id} item={item} list={false} reduce={Boolean(reduce)} onOpen={() => setReader(item)} onToggle={(field) => toggle.mutate({ item, field })} onEdit={() => setEditor(item)} onDelete={() => { if (window.confirm(`Delete “${item.title}”?`)) remove.mutate(item.id); }} />)}</div></section>)}</div> : <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>{items.map((item) => <MaterialCard key={item.id} item={item} list={view === "list"} reduce={Boolean(reduce)} onOpen={() => setReader(item)} onToggle={(field) => toggle.mutate({ item, field })} onEdit={() => setEditor(item)} onDelete={() => { if (window.confirm(`Delete “${item.title}”?`)) remove.mutate(item.id); }} />)}</div>}
        {materialsQuery.hasNextPage && <div className="pt-3 text-center"><ChunkyButton variant="secondary" disabled={materialsQuery.isFetchingNextPage} onClick={() => void materialsQuery.fetchNextPage()}>{materialsQuery.isFetchingNextPage ? "Loading…" : "Load more"}</ChunkyButton></div>}
      </section>
    </Card>
    <MaterialEditor key={editor === "new" ? "new" : editor?.id ?? "closed"} item={editor === "new" ? null : editor} open={editor !== null} folders={foldersQuery.data?.folders ?? []} saving={save.isPending} onClose={() => { if (!save.isPending) { setEditor(null); save.reset(); } }} onSave={(draft) => save.mutate(draft)} />
    <MaterialReader item={reader} onClose={() => setReader(null)} onEdit={() => { if (reader) setEditor(reader); setReader(null); }} />
    {badge && <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 p-4" role="status" aria-live="polite"><div className="w-full max-w-sm rounded-[2rem] border-4 border-sun bg-card p-8 text-center shadow-card"><div className="text-6xl" aria-hidden="true">🏅</div><p className="mt-2 text-xs font-extrabold uppercase tracking-wider text-ink/80">Achievement unlocked</p><h2 className="font-heading text-2xl font-bold">{badge}</h2><ChunkyButton className="mt-5" onClick={() => setBadge(null)}>Keep hopping</ChunkyButton></div></div>}
  </div>;
}

function FolderBranch({ folder, all, selected, onSelect, onRename, onDelete, depth = 0 }: { folder: Folder; all: Folder[]; selected: string; onSelect: (id: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; depth?: number }) {
  const children = all.filter((entry) => entry.parentId === folder.id);
  return <div><div className="group flex items-center gap-1"><button type="button" onClick={() => onSelect(folder.id)} aria-current={selected === folder.id ? "true" : undefined} className={`min-h-10 min-w-0 flex-1 truncate rounded-xl px-2 text-left text-sm font-bold hover:bg-canvas ${selected === folder.id ? "bg-primary/15" : ""}`} style={{ paddingLeft: 10 + depth * 13 }}>📁 {folder.name}</button><button type="button" onClick={() => { const name = window.prompt("Rename subject", folder.name)?.trim(); if (name && name !== folder.name) onRename(folder.id, name); }} aria-label={`Rename folder ${folder.name}`} className="min-h-9 rounded-lg px-2 text-xs underline opacity-70 hover:bg-canvas">✎</button><button type="button" onClick={() => onDelete(folder.id)} aria-label={`Delete folder ${folder.name}`} className="min-h-9 rounded-lg px-2 text-xs text-coral-foreground opacity-70 hover:bg-coral/10">×</button></div>{children.map((child) => <FolderBranch key={child.id} folder={child} all={all} selected={selected} onSelect={onSelect} onRename={onRename} onDelete={onDelete} depth={depth + 1} />)}</div>;
}

function MaterialCard({ item, list, reduce, onOpen, onToggle, onEdit, onDelete }: { item: Material; list: boolean; reduce: boolean; onOpen: () => void; onToggle: (field: "pinned" | "favourite") => void; onEdit: () => void; onDelete: () => void }) {
  const icon = types.find((type) => type.key === item.type)?.icon ?? "📘";
  return <m.article layout={!reduce} whileHover={reduce ? undefined : { y: -2, rotate: .2 }} className={`rounded-3xl border-2 border-border bg-card p-4 shadow-card ${list ? "flex flex-wrap items-center gap-3" : "min-h-48"}`}>
    <button type="button" onClick={onOpen} className={`min-w-0 text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky ${list ? "flex flex-1 items-center gap-3" : "w-full"}`}><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-canvas text-2xl" aria-hidden="true">{icon}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-heading text-lg font-bold">{item.title}</span>{item.pinned && <span aria-label="Pinned">📌</span>}</span><span className="mt-1 block truncate text-xs font-bold text-ink/80">{item.folder?.name ?? item.domain ?? item.fileName ?? item.type} · {new Date(item.updatedAt).toLocaleDateString()}</span>{!list && <span className="mt-2 block text-sm text-ink/75">{item.type === "NOTE" ? <span dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(item.content) }} /> : item.type === "LINK" ? `${item.domain ?? "Web link"} · ${item.url}` : item.type === "VIDEO" ? item.embedUrl ? "YouTube or Vimeo video" : "Uploaded MP4 video" : `${item.mimeType ?? "File"} · ${formatSize(item.size ?? 0)}`}</span>}</span></button>
    <div className={`flex shrink-0 items-center gap-1 ${list ? "ml-auto" : "mt-4 border-t border-border pt-3"}`}><button type="button" onClick={() => onToggle("pinned")} aria-label={item.pinned ? "Unpin material" : "Pin material"} aria-pressed={item.pinned} className="min-h-10 min-w-10 rounded-xl hover:bg-canvas">{item.pinned ? "📌" : "📍"}</button><button type="button" onClick={() => onToggle("favourite")} aria-label={item.favourite ? "Remove favourite" : "Add favourite"} aria-pressed={item.favourite} className="min-h-10 min-w-10 rounded-xl hover:bg-canvas">{item.favourite ? "❤️" : "🤍"}</button><button type="button" onClick={onEdit} className="min-h-10 rounded-xl px-2 text-xs font-bold underline">Edit</button><button type="button" onClick={onDelete} className="min-h-10 rounded-xl px-2 text-xs font-bold text-coral-foreground underline">Delete</button></div>
    {!list && <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.map((tag) => <Tag key={tag} tone="blue">#{tag}</Tag>)}</div>}
  </m.article>;
}

function MaterialEditor({ item, open, folders, saving, onClose, onSave }: { item: Material | null; open: boolean; folders: Folder[]; saving: boolean; onClose: () => void; onSave: (draft: Draft) => void }) {
  const [type, setType] = useState<MaterialType>(item?.type ?? "NOTE");
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [folderId, setFolderId] = useState(item?.folderId ?? "");
  const [file, setFile] = useState<UploadedMaterialFile | null>(item?.fileId && item.downloadUrl ? { id: item.fileId, mimeType: item.mimeType ?? "application/octet-stream", size: item.size ?? 0, url: item.downloadUrl, thumbnailUrl: item.thumbnailUrl } : null);
  const [tagText, setTagText] = useState("");
  const [tags, setTags] = useState(item?.tags ?? []);
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const draftKey = `habithop:material-note-draft:${item?.id ?? "new"}`;
  useEffect(() => { if (open && type === "NOTE") { try { const draft = JSON.parse(window.localStorage.getItem(draftKey) ?? "null") as Partial<Draft> | null; if (draft) { if (draft.title) setTitle(draft.title); if (draft.content) setContent(draft.content); } } catch { /* Ignore an invalid local draft. */ } } }, [open, item, type, draftKey]);
  useEffect(() => { if (editorRef.current && editorRef.current.innerHTML !== content) editorRef.current.innerHTML = sanitizeNoteHtml(content); }, [content, type, open]);
  useEffect(() => { if (!open || type !== "NOTE") return; const timeout = window.setTimeout(() => window.localStorage.setItem(draftKey, JSON.stringify({ type, title, content })), 400); return () => window.clearTimeout(timeout); }, [open, draftKey, type, title, content]);
  const addTag = (candidate: string) => { const next = candidate.trim().replace(/^#+/, "").toLocaleLowerCase(); if (next && next.length <= 32 && !tags.includes(next) && tags.length < 20) setTags((old) => [...old, next]); setTagText(""); };
  const contentFields = type === "NOTE" ? <div className="space-y-2"><div className="flex flex-wrap gap-1 rounded-2xl bg-canvas p-2" role="toolbar" aria-label="Note formatting">{[["Bold", "bold"], ["Italic", "italic"], ["Heading", "formatBlock", "h2"], ["Bulleted list", "insertUnorderedList"], ["Numbered list", "insertOrderedList"]].map(([label, command, value]) => <button key={label} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { editorRef.current?.focus(); document.execCommand(command!, false, value); setContent(editorRef.current?.innerHTML ?? ""); }} className="min-h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold">{label}</button>)}</div><div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Note content" aria-multiline="true" onInput={(event) => setContent(sanitizeNoteHtml(event.currentTarget.innerHTML))} className="min-h-52 max-h-[45vh] overflow-y-auto rounded-2xl border-2 border-border bg-card p-4 focus:border-sky focus:outline-none [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_h2]:font-heading [&_h2]:text-xl [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc" /></div> : type === "FILE" || type === "VIDEO" && !url ? <div className="space-y-2"><MaterialFileUpload value={file} onChange={setFile} videoOnly={type === "VIDEO"} />{file && <p className="text-sm font-bold text-ink/80">{file.mimeType} · {formatSize(file.size)}</p>}</div> : type === "LINK" || type === "VIDEO" ? <label className="grid gap-1.5 text-sm font-bold">{type === "VIDEO" ? "YouTube or Vimeo URL" : "Web address"}<Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /><span className="text-xs font-normal text-ink/80">We never fetch this address. Only YouTube and Vimeo can be embedded as video.</span></label> : null;
  return <Modal open={open} onClose={onClose} title={item ? "Edit material" : "Add to your library"}><form className="max-h-[78vh] space-y-4 overflow-y-auto pr-1" onSubmit={(event) => { event.preventDefault(); const safeContent = sanitizeNoteHtml(content); if (!title.trim()) { setError("Add a title first."); return; } if (type === "NOTE" && !safeContent.replace(/<[^>]*>/g, "").trim()) { setError("Add a little note to save."); return; } if ((type === "FILE" || type === "VIDEO" && !url) && !file) { setError("Choose and upload a file first."); return; } if ((type === "LINK" || type === "VIDEO" && url) && !url.trim()) { setError("Add a web address first."); return; } setError(""); onSave({ type, title: title.trim(), content: safeContent, url: url.trim(), folderId, file, tags }); }}>
    {!item && <div className="grid grid-cols-4 gap-1 rounded-2xl bg-canvas p-1">{types.slice(1).map((choice) => <button type="button" key={choice.key} aria-pressed={type === choice.key} onClick={() => { setType(choice.key as MaterialType); setUrl(""); setFile(null); }} className={`min-h-11 rounded-xl text-xs font-bold ${type === choice.key ? "bg-card shadow" : ""}`}>{choice.icon} {choice.title}</button>)}</div>}
    <label className="grid gap-1.5 text-sm font-bold">Title<Input autoFocus value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Photosynthesis summary" /></label>{contentFields}
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-bold">Subject<select aria-label="Subject folder" value={folderId} onChange={(event) => setFolderId(event.target.value)} className="min-h-12 rounded-2xl border-2 border-border bg-card px-3"><option value="">No subject</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.parentId ? "↳ " : ""}{folder.name}</option>)}</select></label><div className="grid gap-1.5 text-sm font-bold"><label htmlFor="material-tag-input">Tags</label><div className="flex gap-2"><Input id="material-tag-input" value={tagText} maxLength={32} onChange={(event) => setTagText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(tagText); } }} placeholder="Tag, press Enter" /><button type="button" onClick={() => addTag(tagText)} className="rounded-xl px-3 font-bold text-primary-foreground">Add</button></div><div className="flex flex-wrap gap-1">{tags.map((tag) => <button type="button" key={tag} onClick={() => setTags((old) => old.filter((entry) => entry !== tag))} aria-label={`Remove tag ${tag}`}><Tag>#{tag} ×</Tag></button>)}</div></div></div>
    {error && <Toast tone="error" message={error} />}<div className="flex justify-end gap-2"><ChunkyButton type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</ChunkyButton><ChunkyButton type="submit" disabled={saving}>{saving ? "Saving…" : item ? "Save changes" : "Save material"}</ChunkyButton></div>
  </form></Modal>;
}

function MaterialReader({ item, onClose, onEdit }: { item: Material | null; onClose: () => void; onEdit: () => void }) {
  const filePreview = item?.downloadUrl && item.type === "FILE" && item.mimeType === "application/pdf";
  return <Modal open={Boolean(item)} onClose={onClose} title={item?.title ?? "Material"}>{item && <div className="max-h-[70vh] space-y-4 overflow-y-auto">
    <div className="flex flex-wrap items-center gap-2">{item.tags.map((tag) => <Tag key={tag} tone="blue">#{tag}</Tag>)}<span className="text-xs font-bold text-ink/80">Saved {new Date(item.createdAt).toLocaleDateString()}</span></div>
    {item.type === "NOTE" && <><div className="prose max-w-none whitespace-normal [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(item.content) }} /><button type="button" onClick={() => { onClose(); onEdit(); }} className="rounded-xl px-3 py-2 text-sm font-bold text-sky-foreground underline">Edit this note</button></>}
    {filePreview && <iframe title={`PDF: ${item.title}`} src={item.downloadUrl!} className="h-[55vh] w-full rounded-2xl border-2 border-border" />}
    {item.type === "FILE" && item.mimeType?.startsWith("image/") && item.downloadUrl && <Image unoptimized src={item.thumbnailUrl ?? item.downloadUrl} width={1200} height={900} alt={item.title} referrerPolicy="no-referrer" className="mx-auto max-h-[55vh] w-auto rounded-2xl object-contain" />}
    {item.type === "VIDEO" && item.embedUrl && <iframe title={`Video: ${item.title}`} src={item.embedUrl} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" referrerPolicy="no-referrer" allowFullScreen className="aspect-video w-full rounded-2xl" />}
    {item.type === "VIDEO" && item.downloadUrl && <video src={item.downloadUrl} controls className="max-h-[55vh] w-full rounded-2xl" />}
    {item.type === "LINK" && item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="block rounded-2xl bg-canvas p-5 font-bold text-sky-foreground underline">🔗 {item.domain} <span className="block break-all text-sm font-normal text-ink/80">{item.url}</span></a>}
    {item.type === "FILE" && item.downloadUrl && <div className="rounded-2xl bg-canvas p-5"><p className="font-bold">{item.fileName}</p><p className="text-sm text-ink/80">{item.mimeType} · {formatSize(item.size ?? 0)}</p></div>}
    {item.type !== "NOTE" && item.downloadUrl && <a href={item.downloadUrl} download={item.fileName ?? item.title} className="inline-flex min-h-11 items-center rounded-xl bg-primary/15 px-4 font-bold text-primary-foreground underline">⬇ Download file</a>}
    <div className="flex justify-end"><ChunkyButton variant="ghost" onClick={onClose}>Done</ChunkyButton></div>
  </div>}</Modal>;
}

function groupMaterials(items: Material[], grouping: "week" | "month") {
  const map = new Map<string, Material[]>();
  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = grouping === "month" ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : weekStart(date);
    const label = grouping === "month" ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : `Week of ${new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    map.set(label, [...(map.get(label) ?? []), item]);
  }
  return [...map.entries()];
}
function weekStart(date: Date) { const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate()); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`; }
function formatSize(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }
function errorMessage(error: unknown) { return error instanceof ApiClientError ? error.message : "That didn’t save. Please try again."; }

