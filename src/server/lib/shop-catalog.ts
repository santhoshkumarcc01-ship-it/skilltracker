export type ShopItemDefinition = { id: string; name: string; description: string; category: "hat" | "glasses" | "scarf"; price: number; emoji: string; color: string };
export const SHOP_ITEMS: ShopItemDefinition[] = [
  { id: "sunny-cap", name: "Sunny cap", description: "A little sunshine for your pal.", category: "hat", price: 35, emoji: "🧢", color: "var(--color-yellow)" },
  { id: "star-crown", name: "Star crown", description: "For today's tiny champion.", category: "hat", price: 55, emoji: "👑", color: "var(--color-violet)" },
  { id: "round-specs", name: "Round specs", description: "Wise and wonderful looks.", category: "glasses", price: 40, emoji: "🤓", color: "var(--color-aqua)" },
  { id: "heart-shades", name: "Heart shades", description: "A rosy view of the day.", category: "glasses", price: 50, emoji: "🕶️", color: "var(--color-pink)" },
  { id: "mint-scarf", name: "Mint scarf", description: "A cozy pop of color.", category: "scarf", price: 30, emoji: "🧣", color: "var(--color-mint)" },
  { id: "comet-scarf", name: "Comet scarf", description: "A little sparkle for every hop.", category: "scarf", price: 45, emoji: "✨", color: "var(--color-tangerine)" },
];
