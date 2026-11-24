"use client";

import { useQuery } from "@tanstack/react-query";
import { m, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/frontend/lib/api-client";
import { initializeSound, playSound } from "@/frontend/lib/sound";
import { Card, ChunkyButton, Confetti, CountUp, EmptyState, ProgressBar, Skeleton, Tag } from "@/frontend/components/ui";
import { HopPet } from "@/frontend/components/pets/HopPet";

type Report = {
  userId: string; weekStart: string; weekEnd: string; currentWeek: string; timezone: string; summary: string; tips: string[];
  streak: { start: number; end: number; best: number; bestThisWeek: number }; completionRate: number; focusMinutes: number;
  tasks: { completed: number; planned: number }; xpGained: number; level: { before: number; after: number; change: number };
  bestDay: { date: string; label: string; completionRate: number } | null; worstDay: { date: string; label: string; completionRate: number } | null;
  categories: { name: string; planned: number; completed: number; focusMinutes: number }[]; memoriesAdded: number; materialsAdded: number;
  moodTrend: { mood: string; count: number }[]; badges: string[]; friendComparison: { displayName: string; weeklyXp: number }[];
  duoStreaks: { friendName: string; current: number; completedToday: boolean }[];
  daily: { date: string; label: string; planned: number; completed: number; completionRate: number; focusMinutes: number; status: string; xp: number }[];
};

const chartColors = ["var(--palette-58cc02)", "var(--palette-1cb0f6)", "var(--palette-ffc800)", "var(--palette-ce82ff)", "var(--palette-ff9600)", "var(--palette-ff4b4b)"];
function previousWeek(value: string, offset: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }
function prettyDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }

export function ReportDashboard() {
  const [week, setWeek] = useState<string | undefined>();
  const [celebrate, setCelebrate] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const query = useQuery({ queryKey: ["weekly-report", week ?? "current"], queryFn: () => apiRequest<Report>(`/api/v1/report${week ? `?week=${week}` : ""}`) });
  const report = query.data;
  async function download() {
    if (!reportRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(reportRef.current, { cacheBust: true, pixelRatio: 2, filter: (node) => !(node instanceof HTMLElement && node.dataset.private === "true") });
      const link = document.createElement("a"); link.download = `habithop-report-${report?.weekStart ?? "week"}.png`; link.href = dataUrl; link.click();
      initializeSound(); playSound("success"); setCelebrate(true); setShareMessage("Your report image is ready to share!"); window.setTimeout(() => setCelebrate(false), 2200);
    } catch { setShareMessage("The report image could not be created. Please try again."); }
  }

  if (query.isPending) return <main className="space-y-5" aria-busy="true"><Skeleton className="h-48" /><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-80" /></main>;
  if (query.isError || !report) return <main><EmptyState title="Your report took a little detour" description="We couldn't load this week's progress. Check your connection and try again." pet={<HopPet />} /><div className="mt-4 text-center"><ChunkyButton onClick={() => void query.refetch()}>Try again</ChunkyButton></div></main>;
  const noActivity = report.tasks.planned === 0 && report.memoriesAdded === 0 && report.materialsAdded === 0;
  const dateHeading = `${prettyDate(report.weekStart)} – ${prettyDate(report.weekEnd)}`;
  const statCards = [["Activities done", report.tasks.completed, `${report.tasks.planned} planned`], ["Focus minutes", report.focusMinutes, "minutes in focus"], ["XP earned", report.xpGained, `Level ${report.level.after}${report.level.change ? ` · +${report.level.change}` : ""}`], ["Completion", report.completionRate, "% of plans"]] as const;

  return <main className="space-y-6" aria-busy={query.isFetching}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold uppercase tracking-wider text-primary-foreground">Your weekly report</p><h1 className="font-heading text-3xl font-bold">A week of little wins</h1></div><div className="flex items-center gap-2"><ChunkyButton variant="ghost" aria-label="Previous week" onClick={() => setWeek(previousWeek(report.weekStart, -7))}>← <span className="hidden sm:inline">Previous</span></ChunkyButton><span className="min-w-36 text-center font-bold" aria-live="polite">{dateHeading}</span><ChunkyButton variant="ghost" aria-label="Next week" disabled={report.weekStart >= report.currentWeek} onClick={() => setWeek(previousWeek(report.weekStart, 7))}>Next →</ChunkyButton></div></div>
    {noActivity ? <Card><EmptyState title="Your next little win starts here" description="As you complete activities, save memories, and collect learning materials, your weekly report will bloom." pet={<HopPet size={120} />} /></Card> : <>
      <m.section ref={reportRef} className="grid gap-5 rounded-[2rem] border-2 border-border bg-gradient-to-br from-primary/15 via-card to-sky/15 p-6 shadow-card md:grid-cols-[auto_1fr]" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-center"><HopPet size={144} /></div><div className="self-center"><div className="mb-2 flex flex-wrap items-center gap-2"><Tag tone="green">{dateHeading}</Tag><Tag tone="yellow">Best streak: {report.streak.best} days</Tag></div><h2 className="font-heading text-2xl font-bold">Your pet noticed your progress!</h2><p className="mt-2 max-w-3xl text-lg leading-relaxed">{report.summary}</p><ul className="mt-4 grid gap-2 sm:grid-cols-3">{report.tips.map((tip, index) => <li key={tip} className="rounded-2xl border border-border bg-card/80 p-3 text-sm"><span className="mr-1 font-bold text-primary-foreground">Tip {index + 1}.</span>{tip}</li>)}</ul></div>
      </m.section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statCards.map(([label, value, note], index) => <m.div key={label} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}><Card className="h-full"><p className="text-sm font-bold text-ink/80">{label}</p><p className="mt-1 font-heading text-3xl font-extrabold"><CountUp value={value} suffix={label === "Completion" ? "%" : ""} /></p><p className="mt-1 text-sm">{note}</p>{label === "Completion" && <div className="mt-3"><ProgressBar label="Weekly completion" value={report.completionRate} /></div>}</Card></m.div>)}</div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card><h2 className="mb-4 font-heading text-xl font-bold">Daily activities</h2><div className="h-64" role="img" aria-label="Bar chart of planned and completed activities for each day"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="planned" fill="var(--palette-b8c6ce)" radius={[6,6,0,0]} /><Bar dataKey="completed" fill="var(--palette-58cc02)" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div><ChartTable caption="Daily activities" headers={["Day", "Completed", "Planned"]} rows={report.daily.map((d) => [d.label, String(d.completed), String(d.planned)])} /></Card>
        <Card><h2 className="mb-4 font-heading text-xl font-bold">Focus minutes</h2><div className="h-64" role="img" aria-label="Line chart of daily focus minutes"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="focusMinutes" stroke="var(--palette-1cb0f6)" strokeWidth={4} dot={{ r: 5 }} /></LineChart></ResponsiveContainer></div><ChartTable caption="Daily focus minutes" headers={["Day", "Minutes"]} rows={report.daily.map((d) => [d.label, String(d.focusMinutes)])} /></Card>
        <Card><h2 className="mb-4 font-heading text-xl font-bold">Activity categories</h2>{report.categories.length ? <><div className="h-64" role="img" aria-label="Donut chart of activities by category"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report.categories} dataKey="planned" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={3}>{report.categories.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><ChartTable caption="Category breakdown" headers={["Category", "Planned", "Completed", "Focus minutes"]} rows={report.categories.map((d) => [d.name, String(d.planned), String(d.completed), String(d.focusMinutes)])} /></> : <p>No activities in this week yet.</p>}</Card>
        <Card><h2 className="mb-4 font-heading text-xl font-bold">Mood trend</h2>{report.moodTrend.length ? <div className="flex min-h-64 flex-wrap content-center justify-center gap-3" aria-label="Mood trend from saved memories">{report.moodTrend.map((mood) => <div key={mood.mood} className="grid min-w-24 justify-items-center rounded-2xl bg-canvas p-4"><span className="text-4xl" aria-hidden="true">{mood.mood}</span><span className="font-bold">{mood.count} {mood.count === 1 ? "memory" : "memories"}</span></div>)}</div> : <p className="grid min-h-64 place-items-center text-ink/80">Add a mood to a memory to see your trend.</p>}<ChartTable caption="Mood trend" headers={["Mood", "Memories"]} rows={report.moodTrend.map((m) => [m.mood, String(m.count)])} /></Card>
      </div>
      <Card><h2 className="font-heading text-xl font-bold">Your week at a glance</h2><p className="mt-1 text-sm text-ink/80">Daily completion status for {report.timezone}</p><div className="mt-4 grid grid-cols-7 gap-2">{report.daily.map((day) => <div key={day.date} className="text-center"><div title={`${day.date}: ${day.status.toLowerCase()}`} aria-label={`${day.label}, ${day.status.toLowerCase()}`} className={`mx-auto grid h-10 w-10 place-items-center rounded-xl font-bold ${day.status === "COMPLETED" ? "bg-primary text-[var(--palette-183300)]" : day.status === "PARTIAL" ? "bg-sun/70" : day.status === "FROZEN" ? "bg-sky/40" : "bg-canvas text-ink/80"}`}>{day.status === "COMPLETED" ? "✓" : day.status === "FROZEN" ? "❄" : day.planned ? `${day.completed}/${day.planned}` : "·"}</div><span className="mt-1 block text-xs">{day.label}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Tag tone="green">Streak: {report.streak.start} → {report.streak.end}</Tag><Tag tone="yellow">Best this week: {report.streak.bestThisWeek} days</Tag>{report.bestDay && <Tag tone="green">Best day: {report.bestDay.label}</Tag>}{report.worstDay && <Tag tone="coral">Focus next: {report.worstDay.label}</Tag>}<Tag tone="blue">{report.memoriesAdded} memories</Tag><Tag tone="blue">{report.materialsAdded} materials</Tag><Tag tone="purple">{report.badges.length} badges earned</Tag><Tag tone="yellow">Level {report.level.before} → {report.level.after}</Tag></div></Card>
      <div className="grid gap-5 lg:grid-cols-2"><Card><h2 className="font-heading text-xl font-bold">Badge shelf</h2>{report.badges.length ? <ul className="mt-4 flex flex-wrap gap-2">{report.badges.map((badge) => <li key={badge}><Tag tone="purple">🏅 {badge.replaceAll("_", " ")}</Tag></li>)}</ul> : <p className="mt-3 text-ink/80">Your next badge is waiting for a future week.</p>}</Card><Card><h2 className="font-heading text-xl font-bold">Friends & duo streaks</h2>{report.friendComparison.length ? <ul className="mt-3 space-y-2">{report.friendComparison.map((friend) => <li key={friend.displayName} className="flex justify-between rounded-xl bg-canvas p-3"><span>{friend.displayName}</span><strong>{friend.weeklyXp} XP</strong></li>)}</ul> : <p className="mt-3 text-ink/80">Friends who opt in to XP sharing will appear here.</p>}{report.duoStreaks.map((duo) => <p key={duo.friendName} className="mt-3 rounded-xl bg-primary/10 p-3">🔥 {duo.current}-day duo streak · {duo.completedToday ? `You and ${duo.friendName} finished today` : `Waiting for ${duo.friendName}`}</p>)}</Card></div>
      <Card className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-heading text-xl font-bold">Share a little progress</h2><p className="text-sm text-ink/80">The image includes your report and pet summary, never contact details.</p><p aria-live="polite" className="mt-1 text-sm">{shareMessage}</p></div><ChunkyButton onClick={() => void download()}>⬇ Download report image</ChunkyButton></Card>
      {celebrate && <Confetti />}
    </>}
  </main>;
}

function ChartTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] }) {
  return <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-sky-foreground">View chart data</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-left"><caption className="sr-only">{caption}</caption><thead><tr>{headers.map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border">{row.map((value, cell) => <td key={cell} className="p-2">{value}</td>)}</tr>)}</tbody></table></div></details>;
}


