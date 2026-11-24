export type BadgeContext = { streak: number; completedTasks: number; taskCount: number; completedDays: number; completedDaysThisWeek: number; earlyBird: boolean; noteTaker?: boolean; materialCreated?: boolean; friendMade?: boolean; chestOpened?: boolean; memoryCreated?: boolean };
export const BADGES = {
  "first-task": { title: "First little win", description: "You completed your first activity." },
  "streak-3": { title: "Three-day groove", description: "Three completed days in a row." },
  "streak-7": { title: "A whole week", description: "Seven completed days in a row." },
  "streak-30": { title: "Month of momentum", description: "Thirty completed days in a row." },
  "streak-100": { title: "Hundred-day hero", description: "One hundred completed days in a row." },
    "memory-maker": { title: "Memory maker", description: "You saved a story or built a ten-day activity streak." },
    "note-taker": { title: "Note taker", description: "You saved a note to your Material Library." },
  "friend-made": { title: "Friendly hopper", description: "You connected with a friend." },
  "perfect-week": { title: "Perfect week", description: "You completed every day this week." },
  "early-bird": { title: "Early bird", description: "You started an activity before 9 AM." },
  "chest-opener": { title: "Treasure time", description: "You opened a daily chest." },
} as const;
export type BadgeKey = keyof typeof BADGES;

export function evaluateBadgeRules(context: BadgeContext): BadgeKey[] {
  const badges: BadgeKey[] = [];
  if (context.completedTasks > 0) badges.push("first-task");
  if (context.streak >= 3) badges.push("streak-3");
  if (context.streak >= 7) badges.push("streak-7");
  if (context.streak >= 30) badges.push("streak-30");
  if (context.streak >= 100) badges.push("streak-100");
  if (context.memoryCreated || context.completedDays >= 10) badges.push("memory-maker");
  if (context.completedDaysThisWeek >= 7) badges.push("perfect-week");
  if (context.earlyBird) badges.push("early-bird");
  if (context.noteTaker) badges.push("note-taker");
  if (context.materialCreated) badges.push("note-taker");
  if (context.friendMade) badges.push("friend-made");
  if (context.chestOpened) badges.push("chest-opener");
  return badges;
}
