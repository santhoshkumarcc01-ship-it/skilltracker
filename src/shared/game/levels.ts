export function xpForLevel(level: number): number {
  return Math.max(0, level) * (Math.max(0, level) + 1) * 50;
}

export function levelForXp(xp: number): number {
  let level = 0;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function progressInLevel(xp: number): { level: number; current: number; needed: number; percent: number } {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const needed = xpForLevel(level + 1) - start;
  const current = Math.max(0, xp - start);
  return { level, current, needed, percent: Math.min(100, Math.round((current / needed) * 100)) };
}
