"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/frontend/lib/api-client";
import { Card, Skeleton } from "@/frontend/components/ui";

type Badge = { key: string; title: string; description: string; unlockedAt: string | null };
export function AchievementShelf() {
  const badges = useQuery({ queryKey: ["achievements"], queryFn: () => apiRequest<{ badges: Badge[] }>("/api/v1/achievements") });
  if (badges.isPending) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-28" key={index} />)}</div>;
  if (badges.isError || !badges.data) return <Card>We couldn’t load your badges right now.</Card>;
  const unlocked = badges.data.badges.filter((badge) => badge.unlockedAt).length;
  return <div className="space-y-4"><div><p className="text-sm font-extrabold tracking-[.14em] text-primary-foreground">YOUR MILESTONES</p><h1 className="font-heading text-3xl font-bold">A little encouragement</h1><p className="text-ink/80">{unlocked} of {badges.data.badges.length} badges collected. Every small win counts.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{badges.data.badges.map((badge) => <Card key={badge.key} className={badge.unlockedAt ? "border-sun/80 bg-sun/10" : "opacity-70"}><div className="flex items-start gap-3"><span className="text-3xl" aria-hidden="true">{badge.unlockedAt ? "🏅" : "🔒"}</span><div><h2 className="font-heading text-lg font-bold">{badge.title}</h2><p className="text-sm text-ink/80">{badge.description}</p>{badge.unlockedAt && <p className="mt-2 text-xs font-bold text-primary-foreground">Earned {new Date(badge.unlockedAt).toLocaleDateString()}</p>}</div></div></Card>)}</div></div>;
}

