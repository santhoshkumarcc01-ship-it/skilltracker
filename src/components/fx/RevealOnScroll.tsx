"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { useMotionTier } from "@/components/providers/MotionProvider";
import { cn } from "@/lib/utils";

export function RevealOnScroll({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { reduced, tier } = useMotionTier();
  useEffect(() => {
    if (!ref.current || reduced || tier === "LOW" || !("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduced, tier]);
  return <div ref={ref} data-visible={visible} className={cn("reveal-on-scroll", className)} {...props}>{children}</div>;
}
