"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMotionTier } from "@/components/providers/MotionProvider";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export function ChunkyButton({ variant = "primary", size = "md", className, children, loading = false, success = false, magnetic = false, disabled, onPointerDown, onPointerMove, onPointerLeave, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; success?: boolean; magnetic?: boolean }) {
  const { tier, reduced } = useMotionTier();
  const frame = useRef<number | null>(null);
  const point = useRef({ x: 0, y: 0 });
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-primary text-[var(--color-on-primary)] border-primary-shadow shadow-[0_5px_0_var(--color-primary-shadow)]",
    secondary: "bg-sky text-[var(--color-on-secondary)] border-aqua shadow-[0_5px_0_var(--color-aqua)]",
    danger: "bg-coral text-[var(--color-on-danger)] border-danger shadow-[0_5px_0_var(--color-danger)]",
    ghost: "bg-transparent text-ink border-transparent shadow-none hover:bg-canvas",
  };
  const sizes: Record<ButtonSize, string> = { sm: "px-3 py-2 text-sm", md: "px-5 py-3", lg: "px-7 py-4 text-lg" };
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    onPointerMove?.(event);
    if (!magnetic || reduced || tier === "LOW" || event.pointerType !== "mouse") return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    point.current = { x: (event.clientX - rect.left - rect.width / 2) / rect.width, y: (event.clientY - rect.top - rect.height / 2) / rect.height };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      element.style.setProperty("--magnet-x", `${point.current.x * 8}px`);
      element.style.setProperty("--magnet-y", `${point.current.y * 8}px`);
    });
  }
  function pointerLeave(event: PointerEvent<HTMLButtonElement>) {
    onPointerLeave?.(event);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    event.currentTarget.style.setProperty("--magnet-x", "0px");
    event.currentTarget.style.setProperty("--magnet-y", "0px");
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    onPointerDown?.(event);
    if (event.defaultPrevented) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--ripple-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--ripple-y", `${event.clientY - rect.top}px`);
    const target = event.currentTarget;
    target.dataset.ripple = "true";
    window.setTimeout(() => { delete target.dataset.ripple; }, 520);
  }
  return <button aria-busy={loading || undefined} disabled={disabled || loading} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerLeave={pointerLeave} className={cn("chunky-gloss inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border-b-4 font-heading font-semibold shadow-card transition-[transform,filter] duration-150 hover:-translate-y-0.5 active:translate-y-1 active:border-b-0 disabled:cursor-not-allowed disabled:opacity-50", styles[variant], sizes[size], className)} {...props}><span className="button-magnetic-content inline-flex items-center justify-center gap-2">{loading ? <span className="button-spinner" aria-hidden="true" /> : success ? <span aria-hidden="true">✓</span> : null}{children}</span></button>;
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border-2 border-border bg-card p-5 shadow-card", className)} {...props}>{children}</div>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("min-h-12 w-full rounded-2xl border-2 border-border bg-card px-4 text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 focus:border-violet focus:outline-none focus-visible:ring-4 focus-visible:ring-violet/20", className)} {...props} />;
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const score = [value.length >= 8, /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  return <div className="space-y-2"><div className="relative"><Input {...props} ref={ref} type={visible ? "text" : "password"} value={props.value ?? value} onChange={(event) => { setValue(event.target.value); props.onChange?.(event); }} className={cn("pr-20", props.className)} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-bold text-violet-foreground transition-colors hover:text-pink-foreground">{visible ? "Hide" : "Show"}</button></div><div role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} className="flex gap-1">{[0,1,2,3].map((step) => <span key={step} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-150", score > step ? "bg-mint" : "bg-border")} />)}</div><p className="text-xs text-muted">Use 8+ characters with a mix of character types.</p></div>;
});

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { if (!open) return; const previous = document.activeElement as HTMLElement | null; panel.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab" && panel.current) { const items = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex="0"]')]; if (!items.length) { event.preventDefault(); return; } if (document.activeElement === panel.current) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); } else if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } }; }; window.addEventListener("keydown", onKeyDown); return () => { window.removeEventListener("keydown", onKeyDown); previous?.focus(); }; }, [open, onClose]);
  return <AnimatePresence>{open && <m.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><m.section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-6 text-ink shadow-2xl" initial={reduce ? false : { y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { y: 12, opacity: 0 }} transition={{ type: "spring", stiffness: 360, damping: 28 }}><div className="mb-4 flex items-center justify-between"><h2 id={titleId} className="font-heading text-2xl font-bold">{title}</h2><button className="rounded-full p-2 hover:bg-canvas" aria-label="Close dialog" onClick={onClose}>✕</button></div>{children}</m.section></m.div>}</AnimatePresence>;
}
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { open, onClose, title, children } = props;
  const reduce = useReducedMotion();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { if (!open) return; const previous = document.activeElement as HTMLElement | null; panel.current?.focus(); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab" && panel.current) { const items = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex="0"]')]; if (items.length && document.activeElement === panel.current) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); } else if (items.length && event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (items.length && !event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } } }; window.addEventListener("keydown", onKeyDown); return () => { window.removeEventListener("keydown", onKeyDown); previous?.focus(); }; }, [open, onClose]);
  return <AnimatePresence>{open && <m.div className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><m.section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="absolute inset-y-0 right-0 w-full max-w-md overflow-auto border-l-2 border-border bg-card p-6 text-ink" initial={reduce ? { opacity: 0 } : { x: "100%" }} animate={{ x: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }}><div className="mb-5 flex items-center justify-between"><h2 className="font-heading text-2xl font-bold">{title}</h2><button aria-label="Close sheet" onClick={onClose}>✕</button></div>{children}</m.section></m.div>}</AnimatePresence>;
}

export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (value: string) => void }) {
  const baseId = useId();
  return <div><div role="tablist" aria-label="Example tabs" className="flex gap-2 border-b-2 border-border">{tabs.map((tab, index) => <button key={tab} id={`${baseId}-${index}`} role="tab" aria-selected={value === tab} aria-controls={`${baseId}-panel`} tabIndex={value === tab ? 0 : -1} onClick={() => onChange(tab)} onKeyDown={(event) => { const current = tabs.indexOf(tab); let next = current; if (event.key === "ArrowRight") next = (current + 1) % tabs.length; else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length; else if (event.key === "Home") next = 0; else if (event.key === "End") next = tabs.length - 1; else return; event.preventDefault(); onChange(tabs[next]!); document.getElementById(`${baseId}-${next}`)?.focus(); }} className={cn("rounded-t-xl px-4 py-2 font-bold", value === tab ? "border-b-4 border-primary text-ink" : "text-ink/80")}>{tab}</button>)}</div><div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-${Math.max(0, tabs.indexOf(value))}`} className="py-3">{value} preview</div></div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3"><span aria-hidden="true" className={cn("relative h-7 w-12 rounded-full p-1 transition-colors", checked ? "bg-primary" : "bg-border")}><span className={cn("block h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} /></span><span className="font-semibold">{label}</span></button>;
}

export function Tag({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "blue" | "yellow" | "purple" | "coral" }) {
  const tones = { green: "bg-primary/20 text-ink", blue: "bg-sky/20 text-ink", yellow: "bg-sun/30 text-ink", purple: "bg-purple/25 text-ink", coral: "bg-coral/20 text-ink" };
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-bold", tones[tone])}>{children}</span>;
}
export const Pill = Tag;

export function ProgressBar({ value, label = "Progress" }: { value: number; label?: string }) {
  const progress = Math.max(0, Math.min(100, value));
  return <div className="space-y-1"><div className="flex justify-between text-sm font-bold"><span>{label}</span><span>{progress}%</span></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="relative h-4 overflow-hidden rounded-full bg-border"><div className="relative h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }}><span className="absolute inset-y-0 left-0 w-1/3 animate-shine bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:animate-none" /></div></div></div>;
}

export function ProgressRing({ value, label = "Progress" }: { value: number; label?: string }) {
  const progress = Math.max(0, Math.min(100, value));
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="relative grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) ${progress * 3.6}deg, var(--color-border) 0deg)` }}><div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-card font-heading text-xl font-bold">{progress}%</div></div>;
}

export function Toast({ message = "Nice work — your progress is saved!", tone = "success" }: { message?: string; tone?: "success" | "error" }) {
  return <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-center gap-3 rounded-2xl border-2 p-4 font-bold", tone === "success" ? "border-primary/50 bg-primary/10" : "border-coral/50 bg-coral/10")}><span aria-hidden="true">{tone === "success" ? "✨" : "⚠️"}</span>{message}</div>;
}
export function Skeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cn("relative isolate overflow-hidden rounded-2xl bg-surface-2 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent before:animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] motion-reduce:before:animate-none", className)} />; }
export function EmptyState({ pet, title = "Nothing here yet", description = "Your next little win is waiting." }: { pet?: ReactNode; title?: string; description?: string }) { return <div className="grid justify-items-center gap-2 rounded-3xl border-2 border-dashed border-border p-8 text-center">{pet}<h3 className="font-heading text-xl font-bold">{title}</h3><p className="max-w-sm text-ink/80">{description}</p></div>; }
export function Confetti({ active = true }: { active?: boolean }) { const reduce = useReducedMotion(); const bits = ["🎉", "✨", "⭐", "💚", "🎈"]; return <div aria-label={active ? "Celebration confetti" : undefined} className="flex h-12 items-center justify-center gap-2" aria-hidden="true">{active && bits.map((bit, i) => <m.span key={i} animate={reduce ? undefined : { y: [0, -12, 0], rotate: [0, 18, -18, 0] }} transition={{ repeat: reduce ? 0 : Infinity, duration: 1.4, delay: i * 0.1 }}>{bit}</m.span>)}</div>; }
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) { const [shown, setShown] = useState(0); const reduce = useReducedMotion(); useEffect(() => { if (reduce) { setShown(value); return; } const start = performance.now(); let raf = 0; const tick = (now: number) => { const progress = Math.min(1, (now - start) / 650); setShown(Math.round(value * progress)); if (progress < 1) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [value, reduce]); return <span aria-label={`${value}${suffix}`}>{shown}{suffix}</span>; }

