"use client";

import { useRef, type HTMLAttributes, type PointerEvent } from "react";
import { cn } from "@/frontend/lib/utils";

export function SpotlightCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }
  return <div ref={ref} onPointerMove={move} className={cn("spotlight-card relative overflow-hidden rounded-3xl", className)} {...props}>{children}</div>;
}

