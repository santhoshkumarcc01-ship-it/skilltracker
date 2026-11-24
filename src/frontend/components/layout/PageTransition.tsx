"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { durations } from "@/frontend/lib/motion/tokens";

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return <m.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : durations.fast }}>{children}</m.div>;
}

