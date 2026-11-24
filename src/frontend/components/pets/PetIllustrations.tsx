"use client";

import { m, useReducedMotion, type MotionStyle } from "framer-motion";
import type { ReactNode } from "react";

export type PetMood = "idle" | "happy" | "cheering" | "sleepy" | "sad" | "celebrating";
type Props = { mood?: PetMood; size?: number; label?: string; className?: string; style?: MotionStyle };

function MotionFrame({ mood = "idle", size = 112, label, children, ...props }: Props & { children: ReactNode }) {
  const reduce = useReducedMotion();
  const bodyMotion = mood === "cheering" || mood === "celebrating" ? { y: [0, -8, 0], rotate: [0, -3, 3, 0] } : mood === "happy" ? { y: [0, -3, 0] } : mood === "sad" ? { rotate: [0, -3, 0] } : { y: [0, 1.5, 0] };
  return <m.svg role="img" aria-label={label ?? `Original animated pet, ${mood}`} width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" animate={reduce ? undefined : bodyMotion} transition={{ duration: mood === "idle" ? 2.6 : .65, repeat: mood === "idle" ? Infinity : 0, ease: "easeInOut" }} {...props}>{children}</m.svg>;
}

function Eyes({ mood, x1, x2, y = 56, color = "var(--palette-263238)" }: { mood: PetMood; x1: number; x2: number; y?: number; color?: string }) {
  const reduce = useReducedMotion();
  if (mood === "sleepy" || mood === "sad") return <g stroke={color} strokeWidth="4" strokeLinecap="round"><path d={`M${x1 - 4} ${y}q4 4 8 0`} /><path d={`M${x2 - 4} ${y}q4 4 8 0`} /></g>;
  return <g fill={color}>{[x1, x2].map((x) => <m.ellipse key={x} cx={x} cy={y} rx="3.5" ry="5" animate={reduce ? undefined : { scaleY: [1, 1, .12, 1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, .45, .5, .55, 1], ease: "easeInOut" }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />)}</g>;
}

function Smile({ mood, x = 60, y = 70, color = "var(--palette-263238)" }: { mood: PetMood; x?: number; y?: number; color?: string }) {
  const path = mood === "sad" ? `M${x - 8} ${y + 5}q8 -8 16 0` : mood === "cheering" || mood === "celebrating" ? `M${x - 9} ${y}q9 15 18 0` : `M${x - 7} ${y}q7 7 14 0`;
  return <path d={path} stroke={color} strokeWidth="3" strokeLinecap="round" />;
}

export function CatPet({ mood = "idle", size = 112, ...props }: Props) {
  const reduce = useReducedMotion();
  return <MotionFrame mood={mood} size={size} label={`Biscuit the cat, ${mood}`} {...props}>
    <ellipse cx="60" cy="108" rx="30" ry="6" fill="var(--palette-263238)" opacity=".12" />
    <m.path d="M80 85c27 2 29-25 14-28-8-2-12 6-7 10" stroke="var(--palette-d78b57)" strokeWidth="9" strokeLinecap="round" animate={reduce ? undefined : mood === "idle" ? { rotate: [0, 9, -5, 0] } : { rotate: [0, 18, -14, 0] }} transition={{ duration: mood === "idle" ? 2 : .7, repeat: reduce || mood !== "idle" ? 0 : Infinity }} style={{ transformOrigin: "82px 89px" }} />
    <path d="m27 46 4-28 23 17m15 0 22-17 3 29" fill="var(--palette-ffa766)" stroke="var(--palette-b9633c)" strokeWidth="5" strokeLinejoin="round" />
    <path d="M25 71c0-23 15-39 35-39s35 16 35 39v20c0 10-8 16-18 13l-17-6-17 6c-10 3-18-3-18-13V71Z" fill="var(--palette-ffc58f)" stroke="var(--palette-b9633c)" strokeWidth="5" />
    <path d="m32 45 3-15 12 10m28 0 12-10 2 15" fill="var(--palette-f28c6a)" />
    <Eyes mood={mood} x1={47} x2={72} y={61} /><path d="m56 71 4 3 4-3" fill="var(--palette-d56c71)" /><Smile mood={mood} y={81} />
    <path d="M27 71 12 68m16 8-16 2m81-7 15-3M93 78l15 2" stroke="var(--palette-b9633c)" strokeWidth="2.5" strokeLinecap="round" />
    {mood === "sleepy" && <g stroke="var(--palette-8a6bb5)" strokeWidth="3" strokeLinecap="round"><path d="m90 27 4-5m5 11 6-2" /></g>}
  </MotionFrame>;
}

export function FoxPet({ mood = "idle", size = 112, ...props }: Props) {
  const reduce = useReducedMotion();
  return <MotionFrame mood={mood} size={size} label={`Pip the fox, ${mood}`} {...props}>
    <ellipse cx="60" cy="108" rx="31" ry="6" fill="var(--palette-263238)" opacity=".12" />
    <m.path d="M80 89c26 7 32-11 22-21-6-6-15-2-13 5 1 3 4 4 7 2" stroke="var(--palette-e87935)" strokeWidth="13" strokeLinecap="round" animate={reduce ? undefined : mood === "idle" ? { rotate: [0, 8, -7, 0] } : { rotate: [0, 14, -10, 0] }} transition={{ duration: mood === "idle" ? 2.1 : .6, repeat: reduce || mood !== "idle" ? 0 : Infinity }} style={{ transformOrigin: "82px 91px" }} />
    <path d="m28 48-5-34 29 18m12 0 28-18-4 36" fill="var(--palette-f28c42)" stroke="var(--palette-b84e25)" strokeWidth="5" strokeLinejoin="round" />
    <path d="M25 70c0-23 15-38 35-38s35 15 35 38v18c0 16-14 23-28 16l-7-4-8 4c-14 7-27 0-27-16V70Z" fill="var(--palette-f28c42)" stroke="var(--palette-b84e25)" strokeWidth="5" />
    <path d="M33 82c0-12 11-19 27-19s27 7 27 19c0 13-13 22-27 22S33 95 33 82Z" fill="var(--palette-fff0d5)" />
    <path d="M53 75q7-7 14 0-7 10-14 0Z" fill="var(--palette-5b392c)" /><Eyes mood={mood} x1={45} x2={75} y={58} /><Smile mood={mood} y={86} />
    {mood === "cheering" && <path d="m20 53-8-5m87 5 8-5" stroke="var(--palette-ffc800)" strokeWidth="4" strokeLinecap="round" />}
  </MotionFrame>;
}

export function PandaPet({ mood = "idle", size = 112, ...props }: Props) {
  return <MotionFrame mood={mood} size={size} label={`Mochi the panda, ${mood}`} {...props}>
    <ellipse cx="60" cy="108" rx="31" ry="6" fill="var(--palette-263238)" opacity=".12" />
    <path d="M24 57c-11-19 2-36 15-30m42 0c14-7 26 11 15 30" fill="var(--palette-263238)" stroke="var(--palette-202a2d)" strokeWidth="4" />
    <ellipse cx="60" cy="71" rx="39" ry="42" fill="var(--palette-fff)" stroke="var(--palette-9aa8aa)" strokeWidth="4" />
    <ellipse cx="44" cy="62" rx="11" ry="14" transform="rotate(25 44 62)" fill="var(--palette-344246)" /><ellipse cx="76" cy="62" rx="11" ry="14" transform="rotate(-25 76 62)" fill="var(--palette-344246)" />
    <Eyes mood={mood} x1={45} x2={75} y={61} color="var(--palette-fff)" /><ellipse cx="60" cy="74" rx="6" ry="4" fill="var(--palette-263238)" /><Smile mood={mood} y={83} />
    <ellipse cx="30" cy="92" rx="13" ry="10" fill="var(--palette-263238)" /><ellipse cx="90" cy="92" rx="13" ry="10" fill="var(--palette-263238)" />
    {mood === "celebrating" && <path d="m27 27 5-10m56 10-5-10m-25 1 2-11m25 15 9-6" stroke="var(--palette-ce82ff)" strokeWidth="4" strokeLinecap="round" />}
  </MotionFrame>;
}

export function DragonPet({ mood = "idle", size = 112, ...props }: Props) {
  const reduce = useReducedMotion();
  return <MotionFrame mood={mood} size={size} label={`Cinder the dragon, ${mood}`} {...props}>
    <ellipse cx="60" cy="108" rx="31" ry="6" fill="var(--palette-263238)" opacity=".12" />
    <m.path d="m77 78 25 10-13 6 11 8-31-4" fill="var(--palette-6d58c9)" stroke="var(--palette-4b3d9a)" strokeWidth="4" strokeLinejoin="round" animate={reduce ? undefined : mood === "idle" ? { rotate: [0, 7, -6, 0] } : { rotate: [0, 14, -10, 0] }} transition={{ duration: mood === "idle" ? 2 : .6, repeat: reduce || mood !== "idle" ? 0 : Infinity }} style={{ transformOrigin: "78px 83px" }} />
    <path d="m34 43-8-24 25 15m26 0 19-20-2 30" fill="var(--palette-45c4a0)" stroke="var(--palette-168f7a)" strokeWidth="5" strokeLinejoin="round" />
    <path d="m36 35 5 19 8-13m30-1 11 12 3-20" fill="var(--palette-ce82ff)" />
    <path d="M25 69c0-22 15-37 35-37s35 15 35 37v20c0 13-10 21-22 15l-13-7-13 7c-12 6-22-2-22-15V69Z" fill="var(--palette-5ad6b1)" stroke="var(--palette-168f7a)" strokeWidth="5" />
    <path d="M44 77q16 14 32 0v20q-16 12-32 0Z" fill="var(--palette-ffe7a1)" /><Eyes mood={mood} x1={47} x2={73} y={59} /><Smile mood={mood} y={77} />
    <path d="m41 48-6-8m44 0-5 8" stroke="var(--palette-fff)" strokeWidth="3" strokeLinecap="round" />
  </MotionFrame>;
}

export function AxolotlPet({ mood = "idle", size = 112, ...props }: Props) {
  const reduce = useReducedMotion();
  return <MotionFrame mood={mood} size={size} label={`Bloop the axolotl, ${mood}`} {...props}>
    <ellipse cx="60" cy="108" rx="31" ry="6" fill="var(--palette-263238)" opacity=".12" />
    <m.path d="M25 53c-17-24-3-34 4-18 4 8 6 13 10 15m46 3c17-24 3-34-4-18-4 8-6 13-10 15" stroke="var(--palette-ff779e)" strokeWidth="7" strokeLinecap="round" animate={reduce ? undefined : mood === "idle" ? { rotate: [0, 5, -4, 0] } : { rotate: [0, 10, -8, 0] }} transition={{ duration: mood === "idle" ? 2.4 : .6, repeat: reduce || mood !== "idle" ? 0 : Infinity }} style={{ transformOrigin: "60px 52px" }} />
    <path d="M24 66c0-21 15-35 36-35s36 14 36 35v24c0 14-12 22-26 15l-10-5-10 5c-14 7-26-1-26-15V66Z" fill="var(--palette-ffa8c5)" stroke="var(--palette-d96e98)" strokeWidth="5" />
    <path d="M32 84q28 18 56 0v12q-28 16-56 0Z" fill="var(--palette-ffd8e5)" /><Eyes mood={mood} x1={47} x2={73} y={61} /><Smile mood={mood} y={81} />
    <circle cx="34" cy="74" r="4" fill="var(--palette-f07ea3)" /><circle cx="86" cy="74" r="4" fill="var(--palette-f07ea3)" />
    <g fill="var(--palette-62c9d0)"><circle cx="38" cy="92" r="2" /><circle cx="48" cy="97" r="2" /><circle cx="72" cy="97" r="2" /><circle cx="82" cy="92" r="2" /></g>
  </MotionFrame>;
}

export const PET_COMPONENTS = { cat: CatPet, fox: FoxPet, panda: PandaPet, dragon: DragonPet, axolotl: AxolotlPet } as const;

