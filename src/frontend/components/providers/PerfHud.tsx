"use client";

import { useEffect, useState } from "react";
import { useMotionTier } from "@/frontend/components/providers/MotionProvider";

export function PerfHud() {
  const { tier } = useMotionTier();
  const [open, setOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [longTasks, setLongTasks] = useState(0);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const keydown = (event: KeyboardEvent) => { if (event.shiftKey && event.key.toLowerCase() === "p") setOpen((value) => !value); };
    window.addEventListener("keydown", keydown);
    let frames = 0;
    let start = performance.now();
    let raf = 0;
    let active = true;
    const frame = (now: number) => {
      if (!active || document.hidden) return;
      frames++;
      if (now - start >= 1000) { setFps(Math.round(frames * 1000 / (now - start))); frames = 0; start = now; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const observer = typeof PerformanceObserver !== "undefined" ? new PerformanceObserver((list) => setLongTasks((count) => count + list.getEntries().length)) : null;
    try { observer?.observe({ entryTypes: ["longtask"] }); } catch { /* Long task timing is not available in every browser. */ }
    return () => { active = false; cancelAnimationFrame(raf); observer?.disconnect(); window.removeEventListener("keydown", keydown); };
  }, []);
  if (!open || process.env.NODE_ENV !== "development") return null;
  return <aside aria-label="Performance monitor" className="fixed bottom-20 left-3 z-[80] rounded-xl border border-border bg-surface-1/95 p-3 font-mono text-xs text-ink shadow-card lg:bottom-3"><b>HabitHop Perf HUD</b><p>{fps} FPS · {tier} tier</p><p>{longTasks} long task(s)</p><button className="mt-1 underline" onClick={() => setOpen(false)}>Close</button></aside>;
}

