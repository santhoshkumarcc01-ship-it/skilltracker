export type DayStatus = "COMPLETED" | "PARTIAL" | "MISSED" | "FROZEN";

export function localDateAt(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (key: string) => parts.find((value) => value.type === key)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function localMidnight(localDate: string, timeZone: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(candidate));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const observed = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    const delta = target - observed;
    candidate += delta;
    if (delta === 0) break;
  }
  return new Date(candidate);
}

export function weekStartForLocalDate(localDate: string): string {
  const weekday = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return addLocalDays(localDate, weekday === 0 ? -6 : 1 - weekday);
}

export function addLocalDays(localDate: string, amount: number): string {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function localHourAt(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date));
}

export function isOnTime(scheduledStart: string, startedAt: Date, timeZone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(startedAt);
  const local = `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`;
  return local <= scheduledStart;
}

export function completionXp(onTime: boolean): number { return 10 + (onTime ? 5 : 0); }
export { levelForXp, progressInLevel, xpForLevel } from "@/shared/game/levels";

export type StreakState = { current: number; longest: number; lastCompletedDate: string | null; lastStreakDate?: string | null; freezes: number };
export function advanceStreak(state: StreakState, date: string): StreakState {
  if (state.lastCompletedDate === date) return state;
  const anchor = state.lastStreakDate ?? state.lastCompletedDate;
  const consecutive = anchor === addLocalDays(date, -1);
  const current = consecutive ? state.current + 1 : 1;
  return { ...state, current, longest: Math.max(state.longest, current), lastCompletedDate: date, lastStreakDate: date };
}

export function applyMissedDay(state: StreakState, date: string): { state: StreakState; status: "MISSED" | "FROZEN" } {
  const anchor = state.lastStreakDate ?? state.lastCompletedDate;
  if (anchor !== addLocalDays(date, -1)) return { state: { ...state, current: 0, lastStreakDate: date }, status: "MISSED" };
  if (state.current > 0 && state.freezes > 0) return { state: { ...state, freezes: state.freezes - 1, lastStreakDate: date }, status: "FROZEN" };
  return { state: { ...state, current: 0, lastStreakDate: date }, status: "MISSED" };
}
