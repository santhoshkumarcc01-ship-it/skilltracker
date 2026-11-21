export type BoardPosition = { x: number; y: number; width: number; height: number; rotation: number; zIndex: number };

export function clampBoardPosition(position: BoardPosition): BoardPosition {
  const width = clamp(position.width, 12, 46);
  const height = clamp(position.height, 15, 62);
  return {
    x: clamp(position.x, 0, 100 - width),
    y: clamp(position.y, 0, 100 - height),
    width,
    height,
    rotation: clamp(position.rotation, -15, 15),
    zIndex: Math.round(clamp(position.zIndex, 1, 1000)),
  };
}

export function orderByBoardLayer<T extends { zIndex: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }

