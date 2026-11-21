import type { Transition, Variants } from "framer-motion";

export const springTransition: Transition = { type: "spring", stiffness: 420, damping: 28 };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

