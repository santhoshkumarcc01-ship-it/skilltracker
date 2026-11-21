"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { PerfHud } from "@/components/providers/PerfHud";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true, staleTime: 30_000 } } }));
  return <QueryClientProvider client={client}><MotionProvider>{children}<PerfHud /></MotionProvider></QueryClientProvider>;
}

