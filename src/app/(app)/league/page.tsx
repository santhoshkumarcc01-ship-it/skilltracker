"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, Skeleton } from "@/components/ui";

type LeagueData = { league: string; weeklyXp: number; rank: number; participantCount: number; promotionSpots: number; demotionSpots: number; demotionCutoff: number; expiresAt: string; board: { id: string; name: string; pet: { species: string; name: string } | null; weeklyXp: number; rank: number }[] };
const emoji: Record<string, string> = { BRONZE: "🥉", SILVER: "🥈", GOLD: "🥇", SAPPHIRE: "💠", RUBY: "💎", DIAMOND: "💠" };
export default function LeaguePage() {
  const [now, setNow] = useState(0);
  const league = useQuery({ queryKey: ["league"], queryFn: () => apiRequest<LeagueData>("/api/v1/league") });
  const preferences = useQuery({ queryKey: ["preferences"], queryFn: () => apiRequest<{ preferences: { reduceFomo: boolean } }>("/api/v1/preferences").then((result) => result.preferences) });
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  if (league.isPending) return <Skeleton className="h-80" />;
  if (league.isError || !league.data) return <Card>League standings are catching their breath. Try again soon.</Card>;
  const data = league.data;
  const reduceFomo = preferences.data?.reduceFomo ?? false;
  const remaining = Math.max(0, new Date(data.expiresAt).getTime() - now);
  const countdown = `${Math.floor(remaining / 86_400_000)}d ${String(Math.floor((remaining % 86_400_000) / 3_600_000)).padStart(2, "0")}h`;
  return <div className="mx-auto max-w-3xl space-y-5"><Card className="overflow-hidden bg-gradient-to-br from-purple/20 via-card to-sun/20 p-6 text-center"><div className="text-5xl" aria-hidden="true">{emoji[data.league] ?? "🏅"}</div><p className="mt-3 text-sm font-extrabold tracking-[.14em] text-ink/80">THIS WEEK’S LEAGUE</p><h1 className="font-heading text-3xl font-bold">{data.league[0]}{data.league.slice(1).toLowerCase()} League</h1><p className="mt-1 text-ink/80">You’re #{data.rank} of {data.participantCount} · {data.weeklyXp} weekly XP</p><p className="mt-3 text-sm font-bold">{data.participantCount < 5 ? "Your league is growing with real HabitHop members." : reduceFomo ? `${data.promotionSpots} promotion place${data.promotionSpots === 1 ? "" : "s"}. Keep earning at your own pace.` : `Top ${data.promotionSpots} may move up · bottom ${data.demotionSpots} may move down · ${countdown} until the week ends`}</p></Card>
    <Card><div className="flex items-center justify-between"><h2 className="font-heading text-xl font-bold">League board</h2><span className="text-xs font-bold text-ink/80">No bots, just real people</span></div><ol className="mt-4 space-y-2">{data.board.map((row) => <li key={row.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${row.rank === data.rank ? "border-primary bg-primary/10" : "border-border bg-canvas"}`}><span className="w-8 font-heading text-lg font-bold">{row.rank}</span><span className="text-2xl" aria-hidden="true">{row.pet?.species === "fox" ? "🦊" : row.pet?.species === "panda" ? "🐼" : row.pet?.species === "dragon" ? "🐉" : "🐱"}</span><span className="flex-1 font-bold">{row.name}{row.rank === data.rank ? " · You" : ""}</span><span className="font-heading font-bold">{row.weeklyXp} XP</span></li>)}</ol>{data.board.length === 0 && <p className="py-8 text-center text-ink/80">Your league board will appear here as you earn XP.</p>}</Card></div>;
}

