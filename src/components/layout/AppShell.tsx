"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m, MotionConfig } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PageTransition } from "./PageTransition";
import { LogoutButton } from "./LogoutButton";
import { HeaderStats } from "./HeaderStats";
import { NotificationCenter } from "./NotificationCenter";
import { PetCompanion } from "@/components/pets/PetCompanion";
import { initializeSound } from "@/lib/sound";

type Theme = "light" | "dark" | "high-contrast";
type Preferences = { theme: "light" | "dark"; reduceMotion: boolean };
const preferencesKey = ["preferences"] as const;
const links = [
  ["/dashboard", "🏡", "Dashboard", "mint"], ["/story", "📖", "Story", "pink"], ["/materials", "📚", "Library", "aqua"],
  ["/friends", "🫶", "Friends", "violet"], ["/report", "📈", "Report", "yellow"], ["/motivation", "🌟", "Motivation", "tangerine"],
];

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("habithop:theme", theme); } catch { /* Local storage may be disabled. */ }
}

function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const labels: Record<Theme, string> = { light: "Switch to dark theme", dark: "Switch to high contrast theme", "high-contrast": "Switch to light theme" };
  const icons: Record<Theme, string> = { light: "🌙", dark: "◐", "high-contrast": "☀️" };
  return <button type="button" className="min-h-11 rounded-xl border-2 border-border px-3 py-2 font-bold hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky" aria-label={labels[theme]} aria-pressed={theme !== "light"} onClick={onToggle}>{icons[theme]}<span className="sr-only">{theme === "light" ? "Light theme" : theme === "dark" ? "Dark theme" : "High contrast theme"}</span></button>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const client = useQueryClient();
  const preference = useQuery({ queryKey: preferencesKey, queryFn: () => apiRequest<{ preferences: Preferences }>("/api/v1/preferences").then((result) => result.preferences) });
  const themeMutation = useMutation({ mutationFn: (theme: Preferences["theme"]) => apiRequest<{ preferences: Preferences }>("/api/v1/preferences", { method: "PATCH", body: JSON.stringify({ theme }) }), onSuccess: (result) => client.setQueryData(preferencesKey, result.preferences) });
  const [theme, setTheme] = useState<Theme>("light");
  const savedTheme = preference.data?.theme;
  useEffect(() => {
    try { const stored = localStorage.getItem("habithop:theme"); if (stored === "dark" || stored === "light" || stored === "high-contrast") { setTheme(stored); applyTheme(stored); } } catch { /* Local storage may be disabled. */ }
  }, []);
  useEffect(() => { if (savedTheme && theme !== "high-contrast") { setTheme(savedTheme); applyTheme(savedTheme); } }, [savedTheme, theme]);
  useEffect(() => {
    const enabled = Boolean(preference.data?.reduceMotion);
    document.documentElement.dataset.reduceMotion = String(enabled);
    try { localStorage.setItem("habithop:reduce-motion", String(enabled)); } catch { /* Local storage may be disabled. */ }
    window.dispatchEvent(new Event("habithop-motion-preference"));
  }, [preference.data?.reduceMotion]);
  const changeTheme = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "high-contrast" : "light";
    const change = () => { setTheme(next); applyTheme(next); };
    const transitionDocument = document as Document & { startViewTransition?: (callback: () => void) => { ready: Promise<void> } };
    if (transitionDocument.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) transitionDocument.startViewTransition(change);
    else change();
    if (next !== "high-contrast") themeMutation.mutate(next);
  }, [theme, themeMutation]);

  return <MotionConfig reducedMotion={preference.data?.reduceMotion ? "always" : "user"}>
    <div className="min-h-screen bg-canvas text-ink" onPointerDownCapture={initializeSound} onKeyDownCapture={initializeSound}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r-2 border-border bg-card px-5 py-6 lg:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 font-heading text-3xl font-bold"><span aria-hidden="true">🐸</span> HabitHop</Link>
        <nav aria-label="Main navigation" className="grid gap-2">{links.map(([href, icon, title, accent]) => <NavLink key={href} href={href} icon={icon} title={title} accent={accent} active={pathname === href} />)}</nav>
        <div className="mt-auto rounded-3xl bg-primary/15 p-4"><p className="font-heading text-lg font-bold">Keep hopping!</p><p className="text-sm text-ink/80">One small step today.</p></div>
        <div className="mt-3"><LogoutButton /></div>
      </aside>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b-2 border-border bg-card/95 px-4 backdrop-blur lg:ml-64 lg:px-8">
        <Link href="/dashboard" className="font-heading text-xl font-bold lg:hidden">🐸 HabitHop</Link><div className="hidden lg:block" />
        <div className="flex items-center gap-2 sm:gap-4"><HeaderStats /><NotificationCenter /><ThemeButton theme={theme} onToggle={(event) => { const rect = event.currentTarget.getBoundingClientRect(); document.documentElement.style.setProperty("--theme-x", `${rect.left + rect.width / 2}px`); document.documentElement.style.setProperty("--theme-y", `${rect.top + rect.height / 2}px`); changeTheme(); }} /></div>
      </header>
      <main className="aurora-backdrop mx-auto max-w-6xl px-4 py-6 pb-24 lg:ml-64 lg:px-8 lg:pb-10"><AnimatePresence mode="wait" initial={false}><PageTransition key={pathname}>{children}</PageTransition></AnimatePresence></main>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t-2 border-border bg-card px-1 py-2 lg:hidden">{links.map(([href, icon, title, accent]) => <Link key={href} href={href} aria-label={title} aria-current={pathname === href ? "page" : undefined} style={{ "--nav-accent": `var(--color-${accent})` } as React.CSSProperties} className={cn("relative grid justify-items-center gap-0.5 rounded-xl p-1 text-[10px] font-bold", pathname === href ? "text-ink" : "text-muted hover:text-ink")}><span className="relative z-10 text-xl" aria-hidden="true">{icon}</span><span className="relative z-10">{title === "Dashboard" ? "Home" : title}</span>{pathname === href && <m.span layoutId="active-nav-pill" className="absolute inset-0 rounded-xl bg-[color-mix(in_srgb,var(--nav-accent)_25%,transparent)] shadow-[0_0_20px_color-mix(in_srgb,var(--nav-accent)_35%,transparent)]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}</Link>)}</nav>
      <PetCompanion />
    </div>
  </MotionConfig>;
}

function NavLink({ href, icon, title, accent, active }: { href: string; icon: string; title: string; accent: string; active: boolean }) { return <Link href={href} aria-current={active ? "page" : undefined} style={{ "--nav-accent": `var(--color-${accent})` } as React.CSSProperties} className={cn("relative flex min-h-12 items-center gap-3 overflow-hidden rounded-2xl px-4 font-bold transition-colors", active ? "text-ink" : "text-muted hover:bg-canvas hover:text-ink")}><span aria-hidden="true" className="relative z-10 text-xl transition-transform hover:rotate-6">{icon}</span><span className="relative z-10">{title}</span>{active && <m.span layoutId="desktop-active-nav-pill" className="absolute inset-0 rounded-2xl bg-[color-mix(in_srgb,var(--nav-accent)_22%,transparent)] shadow-[0_0_22px_color-mix(in_srgb,var(--nav-accent)_30%,transparent)]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}</Link>; }

