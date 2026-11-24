"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { m, useReducedMotion } from "framer-motion";
import { ApiClientError, apiRequest } from "@/frontend/lib/api-client";
import { initializeSound, playSound } from "@/frontend/lib/sound";
import { levelForXp } from "@/shared/game/levels";
import { emitGameEvent } from "@/frontend/lib/game-events";
import { Card, ChunkyButton, Confetti, CountUp, EmptyState, Input, Modal, ProgressBar, ProgressRing, Sheet, Skeleton, Tag, Toast } from "@/frontend/components/ui";
import { HopPet } from "@/frontend/components/pets/HopPet";

type Task = { id: string; localDate: string; title: string; category: string; scheduledStart: string; plannedMinutes: number; position: number; startedAt: string | null; elapsedSeconds: number; timerRunningSince: string | null; completedAt: string | null; awardedXp: number };
type Stats = { xp: number; gems: number; hearts: number; currentStreak: number; longestStreak: number; streakFreezeCount: number };
type TaskActionResult = { task: Task; xp?: number; chest?: { xp: number; gems: number } | null; dayComplete?: boolean; unlockedBadges?: { key: string; title: string }[] };
type DashboardData = { today: string; timezone: string; dayEndsAt: string; tasks: Task[]; stats: Stats; streakAtRisk: boolean; completedCount: number; progress: number; completionFraction: number; chest: { xp: number; gems: number; expiresAt: string | null; expired: boolean } | null; reduceFomo: boolean; friendsFinished: number };
type CalendarData = { month: string; today: string; days: { date: string; status: string; xpEarned: number; gemsEarned: number }[] };
const tasksKey = ["dashboard"];
const daysKey = (month: string) => ["days", month];
const categories = ["Learning", "Movement", "Mindfulness", "Creative", "Life admin"];

async function loadDashboard() { return apiRequest<DashboardData>("/api/v1/dashboard"); }
async function loadMonth(month: string) { return apiRequest<CalendarData>(`/api/v1/days?month=${month}`); }
function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options); }
function monthShift(month: string, amount: number) { const [year, m] = month.split("-").map(Number); return new Date(Date.UTC(year!, m! - 1 + amount, 1)).toISOString().slice(0, 7); }
function currentMonth(date: string) { return date.slice(0, 7); }

export function Dashboard() {
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const dashboard = useQuery({ queryKey: tasksKey, queryFn: loadDashboard, refetchInterval: 60_000 });
  const [month, setMonth] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [notice, setNotice] = useState("");
  const [chest, setChest] = useState<{ xp: number; gems: number } | null>(null);
  const [badgeToast, setBadgeToast] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [now, setNow] = useState(0);
  const monthValue = month || (dashboard.data ? currentMonth(dashboard.data.today) : currentMonth(new Date().toISOString().slice(0, 10)));
  const calendar = useQuery({ queryKey: daysKey(monthValue), queryFn: () => loadMonth(monthValue), enabled: Boolean(dashboard.data) });
  const tasks = dashboard.data?.tasks ?? [];

  useEffect(() => { if (dashboard.data && !month) setMonth(currentMonth(dashboard.data.today)); }, [dashboard.data, month]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(id); }, [notice]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);

  const addMutation = useMutation({
    mutationFn: (value: Omit<Task, "id" | "position" | "startedAt" | "elapsedSeconds" | "timerRunningSince" | "completedAt" | "awardedXp">) => apiRequest<{ task: Task }>("/api/v1/tasks", { method: "POST", body: JSON.stringify(value) }),
    onMutate: async (value) => { await queryClient.cancelQueries({ queryKey: tasksKey }); const previous = queryClient.getQueryData<DashboardData>(tasksKey); if (previous) queryClient.setQueryData<DashboardData>(tasksKey, { ...previous, tasks: [...previous.tasks, { ...value, id: `optimistic-${Date.now()}`, position: previous.tasks.length, startedAt: null, elapsedSeconds: 0, timerRunningSince: null, completedAt: null, awardedXp: 0 }], progress: previous.progress }); return { previous }; },
    onError: (error, _value, context) => { if (context?.previous) queryClient.setQueryData(tasksKey, context.previous); setNotice(messageOf(error)); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
    onSuccess: () => { playSound("success"); setEditing(null); },
  });
  const editMutation = useMutation({ mutationFn: ({ id, ...body }: { id: string; localDate: string; title?: string; category?: string; scheduledStart?: string; plannedMinutes?: number; position?: number }) => apiRequest<{ task: Task }>(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }), onError: (error) => setNotice(messageOf(error)), onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey }) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => apiRequest(`/api/v1/tasks/${id}?localDate=${dashboard.data!.today}`, { method: "DELETE" }), onMutate: async (id) => { await queryClient.cancelQueries({ queryKey: tasksKey }); const previous = queryClient.getQueryData<DashboardData>(tasksKey); if (previous) queryClient.setQueryData<DashboardData>(tasksKey, { ...previous, tasks: previous.tasks.filter((task) => task.id !== id) }); return { previous }; }, onError: (error, _id, context) => { if (context?.previous) queryClient.setQueryData(tasksKey, context.previous); setNotice(messageOf(error)); }, onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey }) });
  const actionMutation = useMutation<TaskActionResult, Error, { task: Task; action: "start" | "pause" | "resume" | "complete" }, { previous?: DashboardData }>({
    mutationFn: async ({ task, action }: { task: Task; action: "start" | "pause" | "resume" | "complete" }) => {
      if (action === "complete") return apiRequest<{ task: Task; xp: number; chest: { xp: number; gems: number } | null; dayComplete: boolean; unlockedBadges?: { key: string; title: string }[] }>(`/api/v1/tasks/${task.id}/complete`, { method: "POST", body: JSON.stringify({ localDate: dashboard.data!.today }) });
      return apiRequest<{ task: Task }>(`/api/v1/tasks/${task.id}/start`, { method: "POST", body: JSON.stringify({ localDate: dashboard.data!.today, action }) });
    },
    onMutate: async ({ task, action }) => { await queryClient.cancelQueries({ queryKey: tasksKey }); const previous = queryClient.getQueryData<DashboardData>(tasksKey); const now = new Date(); if (previous) queryClient.setQueryData<DashboardData>(tasksKey, { ...previous, tasks: previous.tasks.map((item) => { if (item.id !== task.id) return item; if (action === "complete") return { ...item, completedAt: now.toISOString() }; const pausedElapsed = item.timerRunningSince ? Math.max(0, Math.floor((now.getTime() - new Date(item.timerRunningSince).getTime()) / 1000)) : 0; return { ...item, startedAt: item.startedAt ?? now.toISOString(), elapsedSeconds: item.elapsedSeconds + (action === "pause" ? pausedElapsed : 0), timerRunningSince: action === "pause" ? null : now.toISOString() }; }) }); return { previous }; },
    onError: (error, _vars, context) => { if (context?.previous) queryClient.setQueryData(tasksKey, context.previous); setNotice(messageOf(error)); playSound("error"); },
    onSuccess: (result, variables) => {
      if (variables.action !== "complete" || result.xp === undefined) return;
      const previous = queryClient.getQueryData<DashboardData>(tasksKey);
      const xpAfter = (previous?.stats.xp ?? 0) + result.xp;
      const leveledUp = previous !== undefined && levelForXp(xpAfter) > levelForXp(previous.stats.xp);
      const celebrationTitles: string[] = [];
      emitGameEvent("task-complete");
      if (result.dayComplete) emitGameEvent("streak-up");
      if (leveledUp) {
        emitGameEvent("level-up");
        celebrationTitles.push(`Level ${levelForXp(xpAfter) + 1}!`);
      }
      const unlocked = result.unlockedBadges ?? [];
      if (unlocked.length) {
        const first = unlocked[0];
        if (first) {
          celebrationTitles.push(first.title);
          emitGameEvent("badge-unlock", { message: `You unlocked ${first.title}!` });
        }
      }
      if (celebrationTitles.length) setBadgeToast(celebrationTitles.join(" · "));
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 1800);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["achievements"] });
      void queryClient.invalidateQueries({ queryKey: ["league"] });
      if (result.chest) void queryClient.invalidateQueries({ queryKey: tasksKey });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: tasksKey }); queryClient.invalidateQueries({ queryKey: daysKey(monthValue) }); },
  });
  const chestMutation = useMutation({
    mutationFn: () => apiRequest<{ xp: number; gems: number; unlockedBadges?: { key: string; title: string }[] }>("/api/v1/chest/claim", { method: "POST", body: JSON.stringify({ localDate: dashboard.data!.today }) }),
    onSuccess: (reward) => { setChest(reward); emitGameEvent("chest"); const unlocked = reward.unlockedBadges ?? []; if (unlocked[0]) { setBadgeToast(unlocked[0].title); emitGameEvent("badge-unlock", { message: `You unlocked ${unlocked[0].title}!` }); } void queryClient.invalidateQueries({ queryKey: tasksKey }); void queryClient.invalidateQueries({ queryKey: ["notifications"] }); void queryClient.invalidateQueries({ queryKey: ["achievements"] }); void queryClient.invalidateQueries({ queryKey: ["league"] }); },
    onError: (error) => { setNotice(messageOf(error)); playSound("error"); },
  });
  const freezeMutation = useMutation({ mutationFn: () => apiRequest<{ stats: Stats }>("/api/v1/streak", { method: "POST", body: JSON.stringify({}) }), onError: (error) => setNotice(messageOf(error)), onSuccess: () => { playSound("success"); setNotice("Streak freeze added to your backpack!"); }, onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey }) });
  const data = dashboard.data;
  if (dashboard.isPending) return <div className="grid gap-5 lg:grid-cols-[1.35fr_.85fr]"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-52 lg:col-span-2" /></div>;
  if (dashboard.isError || !data) return <Card><EmptyState pet={<HopPet size={72} />} title="We couldn’t load your day" description="Your progress is safe. Give it another try." /><div className="mt-5 text-center"><ChunkyButton onClick={() => void dashboard.refetch()}>Try again</ChunkyButton></div></Card>;

  const completed = tasks.filter((task) => task.completedAt).length;
  const allDone = tasks.length > 0 && completed === tasks.length;
  const xpLevel = levelForXp(data.stats.xp);
  const xpStart = xpLevel * (xpLevel + 1) * 50;
  const nextLevel = (xpLevel + 1) * (xpLevel + 2) * 50;
  const xpPercent = Math.min(100, Math.round(((data.stats.xp - xpStart) / Math.max(1, nextLevel - xpStart)) * 100));
  const openToday = () => { initializeSound(); playSound("click"); setSheetOpen(true); };
  const updateCacheAfterSave = () => { void queryClient.invalidateQueries({ queryKey: tasksKey }); };

  return <div className="space-y-5 sm:space-y-6">
    <div className="pointer-events-none fixed right-5 top-20 z-30" aria-live="polite">{celebrating && <div role="status" className="rounded-2xl border-2 border-primary/30 bg-card px-4 py-2 shadow-card"><Confetti /><span className="sr-only">Activity complete! Experience earned.</span></div>}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-extrabold tracking-[.14em] text-primary-foreground">YOUR DAILY SPACE</p><h1 className="font-heading text-3xl font-bold sm:text-4xl">Ready for a new hop?</h1><p className="mt-1 text-ink/80">{formatDate(data.today)} · {data.timezone}</p></div><m.div animate={reducedMotion ? undefined : { y: [0, -5, 0], rotate: [0, 2, -2, 0] }} transition={{ duration: 3, repeat: Infinity }}><HopPet size={82} /></m.div></div>

    {notice && <div aria-live="polite" className="fixed right-4 top-20 z-40 max-w-sm"><Toast tone={notice.includes("added") ? "success" : "error"} message={notice} /></div>}
    {data.streakAtRisk && <div role="status" className="flex items-center gap-3 rounded-3xl border-2 border-orange/50 bg-orange/15 p-4 font-bold"><span className="text-2xl" aria-hidden="true">🔥</span><span>{data.reduceFomo ? "There’s still time for a small win today. Your streak is here whenever you’re ready." : `Your streak is at risk. Finish one more activity before your day ends · ${formatCountdown(new Date(data.dayEndsAt).getTime() - now)} left.`}</span></div>}
    {data.friendsFinished > 0 && <div className="rounded-2xl border-2 border-sky/40 bg-sky/10 px-4 py-3 text-sm font-bold">{data.reduceFomo ? `${data.friendsFinished} friend${data.friendsFinished === 1 ? "" : "s"} had a good activity day. You’re on your own path, too.` : `${data.friendsFinished} friend${data.friendsFinished === 1 ? " has" : "s have"} already finished today.`}</div>}
    {data.chest && !data.chest.expired && <Card className="flex flex-wrap items-center justify-between gap-3 border-sun/70 bg-sun/10 p-4"><div><p className="font-heading text-lg font-bold">Your daily chest is ready 🎁</p><p className="text-sm text-ink/80">{data.reduceFomo ? "A little reward is waiting whenever you want it." : `Available until ${data.chest.expiresAt ? new Date(data.chest.expiresAt).toLocaleTimeString([], { timeZone: data.timezone, hour: "numeric", minute: "2-digit" }) : "midnight"} your time.`}</p></div><ChunkyButton disabled={chestMutation.isPending} onClick={() => chestMutation.mutate()}>{chestMutation.isPending ? "Opening…" : "Open chest"}</ChunkyButton></Card>}
    {badgeToast && <div role="status" aria-live="polite" className="fixed inset-0 z-40 grid place-items-center bg-ink/50 p-4"><div className="relative w-full max-w-sm rounded-[2rem] border-4 border-sun bg-card p-8 text-center shadow-card"><Confetti /><div aria-hidden="true" className="mb-3 text-6xl">🏅</div><p className="text-xs font-extrabold uppercase tracking-wider text-ink/80">A new milestone!</p><p className="font-heading text-2xl font-bold">{badgeToast}</p><p className="mt-2 text-sm text-ink/80">Your steady effort is adding up.</p><ChunkyButton className="mt-5" onClick={() => setBadgeToast(null)}>Keep hopping</ChunkyButton></div></div>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Card className="p-3 sm:p-4"><p className="text-sm font-bold text-ink/80">Day streak</p><p className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold"><m.span aria-hidden="true" animate={reducedMotion ? undefined : { scale: [1, 1.1, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>🔥</m.span><CountUp value={data.stats.currentStreak} /></p><button type="button" className="mt-2 text-xs font-bold text-ink underline underline-offset-2 disabled:opacity-50" disabled={freezeMutation.isPending || data.stats.xp < 200} onClick={() => freezeMutation.mutate()} aria-label={`Buy a streak freeze for 200 XP. You have ${data.stats.streakFreezeCount} freezes.`}>🧊 {data.stats.streakFreezeCount} · Get freeze (200 XP)</button></Card>
      <Card className="col-span-2 flex items-center gap-4 p-4"><ProgressRing value={data.progress} label="Today’s tasks complete" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink/80">TODAY’S PATH</p><h2 className="font-heading text-xl font-bold">{completed} / {tasks.length} done</h2><p className="text-sm text-ink/80">{allDone ? "You made it! A chest is yours." : "Every little step counts."}</p></div></Card>
      <Card className="p-4"><div className="flex items-center gap-2"><span aria-hidden="true">⚡</span><span className="text-sm font-bold text-ink/80">LEVEL {xpLevel + 1}</span></div><p className="mt-1 font-heading text-xl font-bold"><CountUp value={data.stats.xp} suffix=" XP" /></p><ProgressBar value={xpPercent} label="Next level" /></Card>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-1"><SmallStat icon="💎" label="Gems" value={data.stats.gems} /><SmallStat icon="💛" label="Hearts" value={data.stats.hearts} /></div>
    </div>

    <Link href="/league" className="block rounded-3xl border-2 border-border bg-gradient-to-r from-purple/15 via-card to-sun/15 p-4 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold tracking-wider text-ink/80">WEEKLY LEAGUE</p><h2 className="font-heading text-lg font-bold">Earn XP with real HabitHop members</h2><p className="text-sm text-ink/80">Your week is yours to shape. View the standings →</p></div><span className="text-3xl" aria-hidden="true">🏅</span></div></Link>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2"><div><p className="text-sm font-bold text-ink/80">YOUR RHYTHM</p><h2 className="font-heading text-2xl font-bold">{new Date(`${monthValue}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div><div className="flex gap-2"><ChunkyButton size="sm" variant="ghost" aria-label="Previous month" onClick={() => setMonth(monthShift(monthValue, -1))}>←</ChunkyButton><ChunkyButton size="sm" variant="ghost" aria-label="Next month" disabled={monthValue >= currentMonth(data.today)} onClick={() => setMonth(monthShift(monthValue, 1))}>→</ChunkyButton></div></div>
        <CalendarGrid data={calendar.data} month={monthValue} today={data.today} onToday={openToday} />
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-ink/80" aria-label="Calendar legend"><Legend color="bg-primary" label="Completed" /><Legend color="bg-sun" label="Partial" /><Legend color="bg-coral" label="Missed" /><Legend color="bg-sky" label="Frozen" /><Legend color="bg-purple" label="Today" /></div>
      </Card>
      <Card className="p-4 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-ink/80">TODAY’S PLAN</p><h2 className="font-heading text-2xl font-bold">Small wins, stacked</h2></div><Tag tone="yellow">{tasks.length} tasks</Tag></div>
        <div className="mt-4 space-y-3">{tasks.length ? tasks.slice(0, 4).map((task) => <TaskPreview key={task.id} task={task} />) : <EmptyState pet={<HopPet size={58} />} title="Your path is open" description="Add a small activity and make today yours." />}</div>
        <ChunkyButton className="mt-4 w-full" onClick={openToday}>{tasks.length ? "Open today’s tasks" : "＋ Add today’s first task"}</ChunkyButton>
      </Card>
    </div>

    <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Today’s activities">
      <div className="space-y-4"><p className="text-sm text-ink/80">Only today can be changed. Your timer saves automatically.</p>
        {tasks.length === 0 && <EmptyState pet={<HopPet size={56} />} title="A fresh start" description="Choose one task you’d like to make time for today." />}
        {tasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} tasks={tasks} completionFraction={data.completionFraction} onAction={(action) => { initializeSound(); playSound("click"); actionMutation.mutate({ task, action }); }} onEdit={() => setEditing(task)} onDelete={() => deleteMutation.mutate(task.id)} onReorder={(position) => editMutation.mutate({ id: task.id, localDate: data.today, position })} busy={addMutation.isPending || actionMutation.isPending || deleteMutation.isPending || editMutation.isPending} />)}
        <TaskEditor key={editing?.id ?? "new"} today={data.today} editing={editing} saving={addMutation.isPending || editMutation.isPending} onCancel={() => setEditing(null)} onSave={(value) => { if (editing) editMutation.mutate({ id: editing.id, ...value }, { onSuccess: () => setEditing(null) }); else addMutation.mutate(value); }} />
        <ChunkyButton variant="ghost" className="w-full" onClick={updateCacheAfterSave}>Refresh today</ChunkyButton>
      </div>
    </Sheet>

    <Modal open={Boolean(chest)} onClose={() => setChest(null)} title="Daily chest!">{chest && <div className="text-center"><Confetti /><div className="text-6xl" aria-hidden="true">🎁</div><p className="mt-2 text-ink/80">You showed up for every task today.</p><p className="my-4 font-heading text-2xl font-bold text-primary-foreground">+{chest.xp} XP · +{chest.gems} 💎</p><ChunkyButton onClick={() => { setChest(null); playSound("streak"); }}>Lovely!</ChunkyButton></div>}</Modal>
  </div>;
}

function messageOf(error: unknown) { return error instanceof ApiClientError ? error.message : "That didn’t save. Please try again."; }
function formatCountdown(milliseconds: number) { const seconds = Math.max(0, Math.floor(milliseconds / 1000)); return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`; }
function SmallStat({ icon, label, value }: { icon: string; label: string; value: number }) { return <Card className="flex items-center justify-center gap-2 p-3"><span className="text-xl" aria-hidden="true">{icon}</span><div><p className="text-xs font-bold text-ink/80">{label}</p><p className="font-heading text-lg font-bold"><CountUp value={value} /></p></div></Card>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />{label}</span>; }

function CalendarGrid({ data, month, today, onToday }: { data?: CalendarData; month: string; today: string; onToday: () => void }) {
  const [year, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year!, m! - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year!, m!, 0)).getUTCDate();
  const map = new Map(data?.days.map((day) => [day.date, day]) ?? []);
  const names = ["S", "M", "T", "W", "T", "F", "S"];
  const tones: Record<string, string> = { completed: "bg-primary/25 border-primary/70", partial: "bg-sun/30 border-sun", missed: "bg-coral/20 border-coral/40", frozen: "bg-sky/20 border-sky/50", future: "bg-canvas border-transparent", today: "bg-purple/20 border-purple ring-2 ring-purple/40" };
  const renderCell = (index: number) => {
    if (index < firstWeekday || index >= firstWeekday + daysInMonth) return <div key={`empty-${index}`} role="gridcell" aria-hidden="true" />;
    const day = index - firstWeekday + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const detail = map.get(date);
    const status = date === today ? "today" : date > today ? "future" : detail?.status ?? "missed";
    const isToday = status === "today";
    const future = status === "future";
    const pastStatus = status === "completed" ? "completed" : status === "partial" ? "partial" : status === "frozen" ? "frozen" : "missed";
    const content = <><span>{day}</span>{future && <span className="text-[10px]" aria-hidden="true">🔒</span>}{!future && !isToday && <span className={`mx-auto h-1.5 w-1.5 rounded-full ${pastStatus === "completed" ? "bg-primary-shadow" : pastStatus === "partial" ? "bg-orange" : pastStatus === "frozen" ? "bg-sky" : "bg-coral"}`} aria-hidden="true" />}</>;
    const label = isToday ? `${date}, today. Select to manage tasks.` : future ? `${date}, locked future date` : `${date}, ${pastStatus}; ${detail?.xpEarned ?? 0} XP and ${detail?.gemsEarned ?? 0} gems earned; read only`;
    const cellClass = `grid aspect-square min-h-10 place-content-center rounded-2xl border-2 text-sm font-bold text-ink/75 ${tones[future ? "future" : isToday ? "today" : pastStatus]}`;
    return <div key={date} role="gridcell" aria-label={label} title={isToday ? undefined : label} aria-disabled={!isToday || undefined} className={`${cellClass} ${isToday ? "p-0" : "cursor-not-allowed"}`}>{isToday ? <button type="button" aria-label={label} aria-current="date" onClick={onToday} className={`grid h-full w-full place-content-center rounded-2xl text-sm font-extrabold hover:brightness-95 focus-visible:outline focus-visible:outline-3 focus-visible:outline-sky ${tones.today}`}>{content}</button> : content}</div>;
  };
  const weeks = Math.ceil((firstWeekday + daysInMonth) / 7);
  return <div role="grid" aria-label={`${month} activity calendar`}>
    <div role="row" className="grid grid-cols-7 gap-1.5 sm:gap-2">{names.map((day, i) => <div role="columnheader" key={`${day}-${i}`} className="py-1 text-center text-xs font-bold text-ink/80" aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]}>{day}</div>)}</div>
    {Array.from({ length: weeks }, (_, week) => <div role="row" key={`week-${week}`} className="grid grid-cols-7 gap-1.5 sm:gap-2">{Array.from({ length: 7 }, (_, column) => renderCell(week * 7 + column))}</div>)}
  </div>;
}

function TaskPreview({ task }: { task: Task }) { return <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3"><span aria-hidden="true" className="text-xl">{task.completedAt ? "✅" : task.startedAt ? "⏳" : "🌱"}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{task.title}</p><p className="text-xs text-ink/80">{task.scheduledStart} · {task.plannedMinutes} min</p></div><span className="text-xs font-bold text-primary-foreground">{task.completedAt ? `+${task.awardedXp} XP` : task.category}</span></div>; }

function TaskEditor({ today, editing, saving, onCancel, onSave }: { today: string; editing: Task | null; saving: boolean; onCancel: () => void; onSave: (value: { localDate: string; title: string; category: string; scheduledStart: string; plannedMinutes: number }) => void }) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState(editing?.category ?? categories[0]!);
  const [scheduledStart, setStart] = useState(editing?.scheduledStart ?? "09:00");
  const [plannedMinutes, setDuration] = useState(editing?.plannedMinutes ?? 25);
  const [error, setError] = useState("");
  return <form className="rounded-3xl border-2 border-border p-4" onSubmit={(event) => { event.preventDefault(); const value = title.trim(); if (!value) { setError("Add a short task title."); return; } setError(""); onSave({ localDate: today, title: value, category, scheduledStart, plannedMinutes }); }}>
    <h3 className="mb-3 font-heading text-xl font-bold">{editing ? "Edit activity" : "Add an activity"}</h3>
    <label className="mb-3 grid gap-1.5 text-sm font-bold">Task title<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Read a chapter" maxLength={120} required /></label>
    <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-sm font-bold">Category<select className="min-h-12 rounded-2xl border-2 border-border bg-card px-3" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1.5 text-sm font-bold">Start time<input className="min-h-12 rounded-2xl border-2 border-border bg-card px-3" aria-label="Scheduled start time" type="time" value={scheduledStart} onChange={(event) => setStart(event.target.value)} required /></label></div>
    <label className="mt-3 grid gap-1.5 text-sm font-bold">Planned duration <span className="flex items-center gap-2"><input aria-label="Planned duration in minutes" className="w-full accent-primary" type="range" min={1} max={180} value={plannedMinutes} onChange={(event) => setDuration(Number(event.target.value))} /><span className="w-16 text-right">{plannedMinutes} min</span></span></label>
    {error && <p role="alert" className="mt-2 text-sm font-bold text-coral-foreground">{error}</p>}
    <div className="mt-4 flex gap-2"><ChunkyButton className="flex-1" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add task"}</ChunkyButton>{editing && <ChunkyButton type="button" variant="ghost" onClick={onCancel}>Cancel</ChunkyButton>}</div>
  </form>;
}

function TaskRow({ task, index, tasks, completionFraction, onAction, onEdit, onDelete, onReorder, busy }: { task: Task; index: number; tasks: Task[]; completionFraction: number; onAction: (action: "start" | "pause" | "resume" | "complete") => void; onEdit: () => void; onDelete: () => void; onReorder: (position: number) => void; busy: boolean }) {
  const [now, setNow] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const runningSeconds = task.elapsedSeconds + (task.timerRunningSince ? Math.max(0, Math.floor((now - new Date(task.timerRunningSince).getTime()) / 1000)) : 0);
  const requiredSeconds = Math.ceil(task.plannedMinutes * 60 * completionFraction);
  const timerPercent = Math.min(100, Math.round((runningSeconds / Math.max(1, task.plannedMinutes * 60)) * 100));
  const remaining = Math.max(0, requiredSeconds - runningSeconds);
  const timerText = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  const complete = Boolean(task.completedAt);
  const action: "start" | "pause" | "resume" = !task.startedAt ? "start" : task.timerRunningSince ? "pause" : "resume";
  const lockTime = task.startedAt ? new Date(task.startedAt).getTime() : null;
  return <m.article layout={!reduced} className="rounded-3xl border-2 border-border bg-canvas p-4">
    <div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 font-heading font-bold">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><h3 className="break-words font-heading text-lg font-bold">{task.title}</h3><p className="text-xs text-ink/80">{task.category} · {task.scheduledStart} · {task.plannedMinutes} min</p></div>{task.startedAt && !complete && <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full font-mono text-xs font-bold" role="progressbar" aria-label={`${task.title} focus timer`} aria-valuemin={0} aria-valuemax={requiredSeconds} aria-valuenow={Math.min(runningSeconds, requiredSeconds)} style={{ background: `conic-gradient(var(--color-primary) ${Math.min(100, runningSeconds / Math.max(1, requiredSeconds) * 100) * 3.6}deg, var(--color-border) 0deg)` }}><span className="grid h-10 w-10 place-items-center rounded-full bg-card">{timerText}</span></div>}{complete && <Tag>Done</Tag>}</div>
    {task.startedAt && !complete && <ProgressBar value={timerPercent} label="Focus timer" />}
    <div className="mt-3 flex flex-wrap items-center gap-2"><ChunkyButton size="sm" variant={task.startedAt ? "secondary" : "primary"} disabled={busy || complete} onClick={() => onAction(action)}>{action === "start" ? "▶ Start" : task.timerRunningSince ? "Ⅱ Pause" : "▶ Resume"}</ChunkyButton><ChunkyButton size="sm" variant="ghost" disabled={busy || complete || !task.startedAt || remaining > 0} aria-describedby={!task.startedAt || remaining > 0 ? `${task.id}-complete-help` : undefined} onClick={() => onAction("complete")}>✓ Complete</ChunkyButton><button type="button" className="min-h-10 rounded-xl px-2 text-sm font-bold text-ink/80 hover:bg-card disabled:opacity-50" disabled={busy || complete || Boolean(lockTime)} onClick={onEdit}>Edit</button><button type="button" className="min-h-10 rounded-xl px-2 text-sm font-bold text-coral-foreground hover:bg-card disabled:opacity-50" disabled={busy || complete} onClick={onDelete}>Delete</button><div className="ml-auto flex gap-1"><button type="button" aria-label={`Move ${task.title} up`} disabled={index === 0 || busy} onClick={() => onReorder(index - 1)} className="h-10 w-10 rounded-xl border border-border font-bold disabled:opacity-40">↑</button><button type="button" aria-label={`Move ${task.title} down`} disabled={index === tasks.length - 1 || busy} onClick={() => onReorder(index + 1)} className="h-10 w-10 rounded-xl border border-border font-bold disabled:opacity-40">↓</button></div></div>
    {(!task.startedAt || remaining > 0) && !complete && <p id={`${task.id}-complete-help`} className="mt-2 text-xs text-ink/80">{!task.startedAt ? "Start your focus timer before completing." : `Focus for ${timerText} more before completing.`}</p>}
  </m.article>;
}


