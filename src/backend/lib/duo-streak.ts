import { addLocalDays } from "@/backend/lib/habit-math";

export type DuoStreakState = { current: number; longest: number; lastDate: string | null };
export function advanceDuoStreak(state: DuoStreakState, duoDate: string, bothCompleted: boolean): DuoStreakState {
  if (!bothCompleted || state.lastDate === duoDate) return state;
  const consecutive = state.lastDate === addLocalDays(duoDate, -1);
  const current = consecutive ? state.current + 1 : 1;
  return { current, longest: Math.max(state.longest, current), lastDate: duoDate };
}
