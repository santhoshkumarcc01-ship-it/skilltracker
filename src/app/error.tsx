"use client";

import { Card, ChunkyButton, EmptyState } from "@/frontend/components/ui";
import { HopPet } from "@/frontend/components/pets/HopPet";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-canvas p-4 text-ink"><Card className="w-full max-w-xl text-center"><EmptyState title="A little hiccup" description="Something went wrong while opening this page. Try again, and your companion will be right here." pet={<HopPet size={128} />} /><div className="mt-5"><ChunkyButton onClick={reset}>Try again</ChunkyButton></div></Card></main>;
}

