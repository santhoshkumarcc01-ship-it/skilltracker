"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { m, useReducedMotion } from "framer-motion";
import { Card, ChunkyButton, Input, Tag } from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import { playSound, initializeSound } from "@/lib/sound";
import { currentUserQueryKey } from "@/components/providers/auth";

const pets = [
  { id: "sprout", name: "Sprout", emoji: "🌱", note: "A little leafy friend" },
  { id: "cloud", name: "Cloud", emoji: "☁️", note: "A soft sky buddy" },
  { id: "comet", name: "Comet", emoji: "☄️", note: "A speedy star pal" },
  { id: "pebble", name: "Pebble", emoji: "🪨", note: "A steady companion" },
] as const;

export default function OnboardingPage() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pet, setPet] = useState<string>(pets[0].id);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setTimezone(detected);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    initializeSound();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/v1/me/profile", { method: "PATCH", body: JSON.stringify({ pet, dailyGoal, timezone, onboarded: true }) });
      playSound("success");
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      router.replace("/dashboard");
    } catch (caught) {
      playSound("error");
      setError(caught instanceof Error ? caught.message : "Could not save your choices. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <header><Tag>FIRST HOP</Tag><h1 className="mt-3 font-heading text-4xl font-bold">Let’s make this yours</h1><p className="mt-2 text-ink/80">Pick a buddy, set a gentle goal, and choose your time zone.</p></header>
    <form className="space-y-6" onSubmit={submit}>
      <Card><fieldset><legend className="mb-4 font-heading text-2xl font-bold">Choose your pet</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{pets.map((item) => <m.button key={item.id} type="button" aria-pressed={pet === item.id} onClick={() => setPet(item.id)} whileHover={reduce ? undefined : { y: -4 }} className={`rounded-2xl border-2 p-4 text-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky ${pet === item.id ? "border-primary bg-primary/15" : "border-border bg-card"}`}><span aria-hidden="true" className="text-4xl">{item.emoji}</span><span className="mt-2 block font-heading text-lg font-bold">{item.name}</span><span className="mt-1 block text-xs text-ink/80">{item.note}</span></m.button>)}</div></fieldset></Card>
      <Card><label htmlFor="daily-goal" className="font-heading text-2xl font-bold">Daily goal: {dailyGoal} {dailyGoal === 1 ? "task" : "tasks"}</label><p className="mb-4 mt-1 text-ink/80">Choose a goal that feels doable on a busy day.</p><input id="daily-goal" type="range" min={1} max={10} step={1} value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))} className="w-full accent-primary" /><div className="flex justify-between text-sm font-semibold"><span>1</span><span>10</span></div></Card>
      <Card><label htmlFor="timezone" className="font-heading text-2xl font-bold">Your time zone</label><p className="mb-4 mt-1 text-ink/80">Detected automatically; edit it if you need to.</p><Input id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} autoComplete="off" required maxLength={100} /></Card>
      {error && <p role="alert" className="rounded-2xl bg-coral/10 p-4 font-semibold">{error}</p>}
      <ChunkyButton size="lg" className="w-full" type="submit" disabled={saving}>{saving ? "Saving your hop…" : "Let’s go!"}</ChunkyButton>
    </form>
  </div>;
}

