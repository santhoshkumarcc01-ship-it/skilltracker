"use client";

import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type MotionTier = "HIGH" | "MID" | "LOW";
type MotionContextValue = { tier: MotionTier; reduced: boolean; setPreviewTier: (tier: MotionTier | null) => void };
const MotionContext = createContext<MotionContextValue>({ tier: "HIGH", reduced: false, setPreviewTier: () => {} });
export const useMotionTier = () => useContext(MotionContext);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);
  const [tier, setTier] = useState<MotionTier>("HIGH");
  const [previewTier, setPreviewTier] = useState<MotionTier | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const stored = localStorage.getItem("habithop:reduce-motion") === "true";
      const shouldReduce = stored || media.matches;
      setReduced(shouldReduce);
      const connection = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
      const lowDevice = (navigator.hardwareConcurrency || 8) <= 4 || (connection.deviceMemory ?? 8) <= 4 || connection.connection?.saveData;
      const nextTier: MotionTier = shouldReduce || lowDevice ? "LOW" : (navigator.hardwareConcurrency || 8) <= 8 ? "MID" : "HIGH";
      setTier(nextTier);
      document.documentElement.dataset.reduceMotion = String(shouldReduce);
      document.documentElement.dataset.motionTier = nextTier.toLowerCase();
    };
    sync();
    const preferenceChanged = () => sync();
    media.addEventListener("change", sync);
    window.addEventListener("habithop-motion-preference", preferenceChanged);
    const setPaused = () => {
      document.documentElement.classList.toggle("animations-paused", document.hidden);
      if (document.hidden) return;
      document.querySelectorAll<HTMLElement>(".aurora-backdrop").forEach((element) => { element.dataset.offscreen = "false"; });
    };
    const observer = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => { (target as HTMLElement).dataset.offscreen = String(!isIntersecting); }));
    document.querySelectorAll(".aurora-backdrop").forEach((element) => observer.observe(element));
    document.addEventListener("visibilitychange", setPaused);
    return () => { media.removeEventListener("change", sync); window.removeEventListener("habithop-motion-preference", preferenceChanged); document.removeEventListener("visibilitychange", setPaused); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (reduced || tier === "LOW") return;
    let frames = 0;
    let start = performance.now();
    let lowSince = 0;
    let frame = 0;
    let stopped = false;
    const tick = (now: number) => {
      if (stopped) return;
      frames++;
      if (now - start >= 1000) {
        const fps = frames * 1000 / (now - start);
        if (fps < 45) {
          lowSince ||= now;
          if (now - lowSince >= 2000) {
            setTier("LOW");
            document.documentElement.dataset.motionTier = "low";
            return;
          }
        } else lowSince = 0;
        frames = 0;
        start = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [reduced, tier]);

  const activeTier = previewTier ?? tier;
  useEffect(() => { document.documentElement.dataset.motionTier = activeTier.toLowerCase(); }, [activeTier]);
  const context = useMemo(() => ({ tier: activeTier, reduced, setPreviewTier }), [activeTier, reduced]);
  return <MotionContext.Provider value={context}><LazyMotion features={domAnimation} strict><MotionConfig reducedMotion={reduced ? "always" : "user"}>{children}</MotionConfig></LazyMotion></MotionContext.Provider>;
}

