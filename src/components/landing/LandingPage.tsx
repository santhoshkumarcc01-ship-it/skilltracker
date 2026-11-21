"use client";

import { m, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChunkyButton } from "@/components/ui";
import { HopPet } from "@/components/pets/HopPet";

export function LandingPage() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const float = (delay: number) => reduce ? undefined : { y: [0, -14, 0], rotate: [0, 8, 0], transition: { duration: 4, repeat: Infinity, delay } };
  return <main className="aurora-backdrop grain-overlay relative grid min-h-screen overflow-hidden bg-canvas px-5 py-12 text-ink">
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <m.span animate={float(0)} className="absolute left-[9%] top-[18%] text-5xl text-sun">✦</m.span>
      <m.span animate={float(0.8)} className="absolute right-[12%] top-[20%] text-6xl text-purple">●</m.span>
      <m.span animate={float(1.3)} className="absolute bottom-[18%] left-[17%] text-4xl text-sky">✿</m.span>
      <m.span animate={float(0.5)} className="absolute bottom-[23%] right-[11%] text-5xl text-orange">✦</m.span>
      <div className="absolute inset-0 bg-gradient-to-b from-card/10 via-transparent to-violet/5" />
    </div>
    <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-[1.1fr_.9fr]">
      <section className="order-2 text-center md:order-1 md:text-left">
        <p className="font-heading text-2xl font-bold"><span className="text-gradient-aurora">✦ HabitHop</span></p>
        <h1 className="mt-5 font-heading text-5xl font-bold leading-[1.08] sm:text-6xl">Little steps.<br /><span className="text-gradient-aurora">Big streaks.</span></h1>
        <p className="mx-auto mt-5 max-w-lg text-lg text-muted md:mx-0">Make room for the things that matter, one joyful daily hop at a time.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4 md:justify-start">
          <ChunkyButton size="lg" onClick={() => router.push("/signup")}>Create account</ChunkyButton>
          <ChunkyButton size="lg" variant="secondary" onClick={() => router.push("/login")}>Sign in</ChunkyButton>
        </div>
        <p className="mt-6 text-sm text-muted">No streak pressure. Just a fresh start whenever you’re ready.</p>
      </section>
      <m.div className="order-1 mx-auto grid h-72 w-72 place-items-center rounded-full bg-card/80 shadow-2xl ring-8 ring-white/50 md:order-2 md:h-96 md:w-96" animate={reduce ? undefined : { y: [0, -10, 0] }} transition={{ duration: 3.6, repeat: Infinity }}>
        <HopPet size={230} label="HabitHop’s cheerful original mascot" />
      </m.div>
    </div>
  </main>;
}

