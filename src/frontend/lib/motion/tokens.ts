import type { Transition, Variants } from "framer-motion";

export const durations = { instant: 0.09, fast: 0.16, base: 0.24, slow: 0.42, epic: 0.8 } as const;
export const easings = {
  standard: [0.2, 0, 0, 1] as const,
  emphasizedOut: [0.16, 1, 0.3, 1] as const,
  snappy: [0.2, 0.8, 0.2, 1] as const,
};
export const springs: Record<"soft" | "bouncy" | "stiff" | "wobble", Transition> = {
  soft: { type: "spring", stiffness: 240, damping: 28 },
  bouncy: { type: "spring", stiffness: 420, damping: 20 },
  stiff: { type: "spring", stiffness: 520, damping: 36 },
  wobble: { type: "spring", stiffness: 320, damping: 12, mass: 0.8 },
};

export const fadeUp: Variants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: durations.base, ease: easings.emphasizedOut } } };
export const popIn: Variants = { hidden: { opacity: 0, scale: 0.94 }, visible: { opacity: 1, scale: 1, transition: springs.bouncy } };
export const slideSheet: Variants = { hidden: { opacity: 0, x: "8%" }, visible: { opacity: 1, x: 0, transition: springs.soft }, exit: { opacity: 0, x: "4%", transition: { duration: durations.fast } } };
export const shake: Variants = { idle: { x: 0 }, error: { x: [0, -7, 6, -4, 2, 0], transition: { duration: durations.slow } } };
export const wobble: Variants = { idle: { rotate: 0 }, active: { rotate: [0, -2, 2, -1, 0], transition: { duration: durations.slow } } };
export const float: Variants = { idle: { y: 0 }, active: { y: [0, -6, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } } };
export const pulseGlow: Variants = { idle: { opacity: 0.45 }, active: { opacity: [0.35, 0.8, 0.35], transition: { duration: 2.2, repeat: Infinity } } };
export const flameFlicker: Variants = { idle: { scale: 1, rotate: 0 }, active: { scale: [1, 1.08, 0.98, 1], rotate: [0, 2, -2, 0], transition: { duration: 1.1, repeat: Infinity } } };
export const countUp = { duration: 0.65, ease: easings.standard } satisfies Transition;
export const rubberBand: Variants = { idle: { scale: 1 }, active: { scale: [1, 1.08, 0.96, 1.02, 1], transition: { duration: durations.slow } } };

export function stagger(delay = 0.06): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren: delay, delayChildren: 0.02 } } };
}

