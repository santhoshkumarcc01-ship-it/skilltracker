"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/frontend/lib/api-client";
import { emitGameEvent, subscribeGameEvents, type GameEvent } from "@/frontend/lib/game-events";
import { initializeSound, playSound } from "@/frontend/lib/sound";
import { PET_COMPONENTS, type PetMood } from "@/frontend/components/pets/PetIllustrations";
import { ChunkyButton } from "@/frontend/components/ui";

type PetData = { species: keyof typeof PET_COMPONENTS; name: string; bondLevel: number; bondXp: number; equippedHat: string | null; equippedGlasses: string | null; equippedScarf: string | null; inventory: { id: string; emoji: string; category: string }[] };
type CompanionDay = { streakAtRisk: boolean; reduceFomo: boolean };
const copy: Record<GameEvent["type"], { mood: PetMood; message: string }> = {
  "task-complete": { mood: "cheering", message: "Lovely work! You showed up for yourself." },
  "streak-up": { mood: "celebrating", message: "Your rhythm is growing. I’m proud of you!" },
  chest: { mood: "celebrating", message: "Treasure time! Let’s see what’s inside." },
  poke: { mood: "happy", message: "Hehe! That tickles." },
  feed: { mood: "happy", message: "Yum! Thanks for the snack." },
  "pet-update": { mood: "happy", message: "Looking good! I love my new style." },
  "level-up": { mood: "cheering", message: "A new level! Look at you go!" },
  mistake: { mood: "sad", message: "That’s okay. We can try again together." },
  purchase: { mood: "happy", message: "Ooh, a new look! I love it." },
  "badge-unlock": { mood: "celebrating", message: "A shiny new badge. You earned it!" },
  "memory-saved": { mood: "happy", message: "A lovely memory to keep." },
  "note-saved": { mood: "happy", message: "That’s a note worth keeping!" },
};

export function PetCompanion() {
  const reduce = useReducedMotion();
  const query = useQuery({ queryKey: ["user-pet"], queryFn: () => apiRequest<{ pet: PetData }>("/api/v1/pets").then((result) => result.pet), staleTime: 60_000 });
  const day = useQuery({ queryKey: ["dashboard"], queryFn: () => apiRequest<CompanionDay>("/api/v1/dashboard"), staleTime: 30_000 });
  const [mood, setMood] = useState<PetMood>("idle");
  const [message, setMessage] = useState("A tiny step is a real step. What shall we do today?");
  const [expanded, setExpanded] = useState(true);
  const reactionTimer = useRef<number | null>(null);
  const pet = query.data;
  const Pet = pet ? PET_COMPONENTS[pet.species] : null;
  const refetchPet = query.refetch;

  useEffect(() => {
    const unsubscribe = subscribeGameEvents((event) => {
      const next = copy[event.type];
      setMood(next.mood);
      setMessage(typeof event.detail?.message === "string" ? event.detail.message : next.message);
      initializeSound();
      const soundFor: Partial<Record<GameEvent["type"], "success" | "streak" | "chest" | "poke" | "levelUp" | "error" | "purchase">> = { "task-complete": "success", "streak-up": "streak", chest: "chest", poke: "poke", feed: "success", "pet-update": "success", "level-up": "levelUp", mistake: "error", purchase: "purchase", "badge-unlock": "levelUp", "memory-saved": "success", "note-saved": "success" };
      const sound = soundFor[event.type];
      if (sound) playSound(sound);
      if (event.type === "task-complete") void refetchPet();
      if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
      reactionTimer.current = window.setTimeout(() => setMood("idle"), 3600);
    });
    return () => { unsubscribe(); if (reactionTimer.current) window.clearTimeout(reactionTimer.current); };
  }, [refetchPet]);

  useEffect(() => {
    if (!day.data?.streakAtRisk) return;
    setMood("sleepy");
    setMessage(day.data.reduceFomo ? "There’s still time for a little win today, whenever you’re ready." : "A little activity before the day ends can keep your rhythm going.");
  }, [day.data?.streakAtRisk, day.data?.reduceFomo]);

  if (!pet || !Pet) return null;
  const accessory = (id: string | null) => pet.inventory.find((item) => item.id === id)?.emoji;
  const poke = () => emitGameEvent("poke");
  return <aside aria-label="Your pet companion" className="fixed bottom-[5.25rem] right-3 z-30 flex flex-col items-end gap-2 lg:bottom-5 lg:right-5">
    {expanded && <m.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-[min(18rem,calc(100vw-2rem))] rounded-3xl border-2 border-border bg-card p-3 shadow-card">
      <div className="flex items-start gap-3"><div className="relative shrink-0"><Pet mood={mood} size={78} /><Accessory top="0" emoji={accessory(pet.equippedHat)} /><Accessory top="24px" emoji={accessory(pet.equippedGlasses)} /><Accessory top="47px" emoji={accessory(pet.equippedScarf)} /></div><div className="min-w-0"><p className="font-heading font-bold">{pet.name} <span className="text-xs text-ink/80">· Bond {pet.bondLevel}</span></p><p className="mt-1 text-sm leading-snug text-ink/80">{message}</p><div className="mt-2 flex gap-2"><Link href="/shop" className="text-xs font-bold underline underline-offset-2">Visit pet shop</Link><Link href="/settings#pet" className="text-xs font-bold underline underline-offset-2">Customize</Link></div></div></div>
    </m.div>}
    <div className="flex items-center gap-2"><ChunkyButton size="sm" variant="secondary" onClick={poke} aria-label={`Poke ${pet.name}`}>Poke</ChunkyButton><button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? "Hide pet companion" : "Show pet companion"} className="grid h-14 w-14 place-items-center rounded-full border-3 border-primary bg-card shadow-card focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky">{!expanded && <Pet mood={mood} size={48} />}{expanded && <span aria-hidden="true">⌄</span>}</button></div>
  </aside>;
}

function Accessory({ emoji, top }: { emoji?: string; top: string }) { return emoji ? <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 text-xl" style={{ top }}>{emoji}</span> : null; }

