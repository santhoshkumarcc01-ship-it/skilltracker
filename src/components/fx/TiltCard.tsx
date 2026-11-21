"use client";

import { useRef, type HTMLAttributes, type PointerEvent } from "react";
import { useMotionTier } from "@/components/providers/MotionProvider";
import { cn } from "@/lib/utils";

export function TiltCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { tier, reduced } = useMotionTier();
  const frame = useRef<number | null>(null);
  const point = useRef({ x: 0, y: 0 });
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || tier === "LOW" || reduced) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    point.current = { x: (event.clientX - rect.left) / rect.width - .5, y: (event.clientY - rect.top) / rect.height - .5 };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      element.style.setProperty("--tilt-x", `${-point.current.y * 8}deg`);
      element.style.setProperty("--tilt-y", `${point.current.x * 8}deg`);
    });
  }
  function reset(event: PointerEvent<HTMLDivElement>) {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }
  return <div onPointerMove={move} onPointerLeave={reset} className={cn("tilt-card", className)} {...props}>{children}</div>;
}

