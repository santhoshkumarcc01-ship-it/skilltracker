"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/frontend/lib/api-client";
import { ChunkyButton } from "@/frontend/components/ui";

type Notice = { id: string; title: string; message: string; type: string; readAt: string | null; createdAt: string };
type NoticeData = { items: Notice[]; unreadCount: number };
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const notices = useQuery({ queryKey: ["notifications"], queryFn: () => apiRequest<NoticeData>("/api/v1/notifications") });
  const markRead = useMutation({ mutationFn: () => apiRequest<NoticeData>("/api/v1/notifications", { method: "PATCH", body: JSON.stringify({ readAll: true }) }), onSuccess: (data) => queryClient.setQueryData(["notifications"], data) });
  return <div className="relative"><button type="button" aria-label={`Notifications, ${notices.data?.unreadCount ?? 0} unread`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-xl border-2 border-border bg-card text-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky">🔔{Boolean(notices.data?.unreadCount) && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{notices.data?.unreadCount}</span>}</button>
    {open && <section aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(21rem,calc(100vw-1.5rem))] rounded-3xl border-2 border-border bg-card p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-xl font-bold">Little updates</h2><button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="rounded-xl px-2 py-1">×</button></div><div className="max-h-72 space-y-2 overflow-y-auto">{notices.data?.items.length ? notices.data.items.map((item) => <article key={item.id} className={`rounded-2xl p-3 ${item.readAt ? "bg-canvas" : "bg-primary/10"}`}><p className="font-bold">{item.title}</p><p className="mt-1 text-sm text-ink/75">{item.message}</p></article>) : <p className="py-5 text-center text-sm text-ink/80">No new updates. You’re all caught up.</p>}</div>{Boolean(notices.data?.unreadCount) && <ChunkyButton size="sm" variant="ghost" className="mt-3 w-full" disabled={markRead.isPending} onClick={() => markRead.mutate()}>Mark all read</ChunkyButton>}</section>}
  </div>;
}

