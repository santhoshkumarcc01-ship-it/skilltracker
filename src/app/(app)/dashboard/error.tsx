"use client";

import { useEffect } from "react";
import { ChunkyButton, Card, EmptyState } from "@/frontend/components/ui";
import { HopPet } from "@/frontend/components/pets/HopPet";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Dashboard boundary caught an error."); }, []);
  return <Card className="mx-auto max-w-xl text-center"><EmptyState pet={<HopPet size={72} />} title="A tiny hop went sideways" description="Your saved progress is still here. Try loading your dashboard again." /><ChunkyButton className="mt-5" onClick={() => reset()}>Try again</ChunkyButton></Card>;
}

