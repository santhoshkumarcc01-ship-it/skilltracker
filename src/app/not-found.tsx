import Link from "next/link";
import { Card, ChunkyButton, EmptyState } from "@/frontend/components/ui";
import { HopPet } from "@/frontend/components/pets/HopPet";

export default function NotFound() {
  return <main className="grid min-h-[80vh] place-items-center bg-canvas p-4 text-ink"><Card className="w-full max-w-xl"><EmptyState title="This page hopped away" description="That address doesn’t lead anywhere right now. Your progress is safe—let’s find another path." pet={<HopPet size={128} />} /><div className="mt-5 flex justify-center"><Link href="/"><ChunkyButton>Back to HabitHop</ChunkyButton></Link></div></Card></main>;
}

