export type GameEventName = "task-complete" | "streak-up" | "chest" | "poke" | "feed" | "pet-update" | "level-up" | "mistake" | "purchase" | "badge-unlock" | "memory-saved" | "note-saved";
export type GameEvent = { type: GameEventName; detail?: Record<string, unknown> };

const EVENT_NAME = "habithop:game-event";
export function emitGameEvent(type: GameEventName, detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const navigatorWithHaptics = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (type === "task-complete") navigatorWithHaptics.vibrate?.(18);
  if (type === "streak-up") navigatorWithHaptics.vibrate?.([18, 24, 28]);
  if (type === "mistake") navigatorWithHaptics.vibrate?.(35);
  window.dispatchEvent(new CustomEvent<GameEvent>(EVENT_NAME, { detail: { type, detail } }));
}
export function subscribeGameEvents(listener: (event: GameEvent) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handle = (event: Event) => listener((event as CustomEvent<GameEvent>).detail);
  window.addEventListener(EVENT_NAME, handle);
  return () => window.removeEventListener(EVENT_NAME, handle);
}

