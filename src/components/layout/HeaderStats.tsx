"use client";

import { useQuery } from "@tanstack/react-query";
import { m, useReducedMotion } from "framer-motion";
import { apiRequest } from "@/lib/api-client";
import { Skeleton } from "@/components/ui";

type HeaderData = { stats: { xp: number; gems: number; hearts: number; currentStreak: number }; progress: number };
export function HeaderStats() {
  const reduced = useReducedMotion();
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => apiRequest<HeaderData>("/api/v1/dashboard"), staleTime: 30_000 });
  if (!query.data) return <div className="flex items-center gap-2" aria-label="Loading your stats"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-20" /></div>;
  const stats = query.data.stats;
  return <div className="flex max-w-[72vw] items-center gap-2 overflow-x-auto sm:max-w-none sm:gap-4" aria-label="Your progress">
    <div className="flex shrink-0 items-center gap-1 font-heading font-bold" aria-label={`${stats.currentStreak} day streak`}><m.span aria-hidden="true" animate={reduced ? undefined : { scale: [1, 1.12, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-lg">🔥</m.span><span>{stats.currentStreak}</span><span className="hidden text-xs text-ink/80 md:inline">day streak</span></div>
    <div className="flex shrink-0 items-center gap-1.5 font-heading font-bold" aria-label={`${stats.xp} experience points`}><span aria-hidden="true">⚡</span><span>{stats.xp}</span><span className="hidden text-xs text-ink/80 md:inline">XP</span></div>
    <div className="hidden shrink-0 items-center gap-1.5 font-heading font-bold sm:flex" aria-label={`${stats.gems} gems`}><span aria-hidden="true">💎</span><span>{stats.gems}</span></div>
    <div className="hidden shrink-0 items-center gap-1.5 font-heading font-bold md:flex" aria-label={`${stats.hearts} hearts`}><span aria-hidden="true">💛</span><span>{stats.hearts}</span></div>
    <div role="progressbar" aria-label="Today progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={query.data.progress} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) ${query.data.progress * 3.6}deg, var(--color-border) 0deg)` }}><span className="grid h-8 w-8 place-items-center rounded-full bg-card text-[10px] font-bold">{query.data.progress}%</span></div>
  </div>;
}

