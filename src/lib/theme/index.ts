export type ThemeMode = "light" | "dark" | "high-contrast";

/** Canonical Aurora Arcade palette. Other UI colors should reference semantic tokens. */
export const themeColors = {
  mint: "#2EE6A6", mintShadow: "#12B886", violet: "#7C5CFF", violetShadow: "#5A3FE0",
  pink: "#FF4D9D", yellow: "#FFD23F", tangerine: "#FF8A3D", aqua: "#28D7FF", danger: "#FF5A5F",
  midnight: "#0E0B24", darkSurface1: "#1A1540", darkSurface2: "#251E5A", darkText: "#F3F0FF", darkMuted: "#A89FD8",
  cream: "#FFF8F0", white: "#FFFFFF", lightInk: "#2B2350", lightMuted: "#6B6395",
  aurora: ["#2EE6A6", "#28D7FF", "#7C5CFF", "#FF4D9D"],
  sunset: ["#FFD23F", "#FF8A3D", "#FF4D9D"],
  candy: ["#FF4D9D", "#7C5CFF"],
} as const;

export const sectionAccents = {
  dashboard: "var(--color-mint)", story: "var(--color-pink)", library: "var(--color-aqua)",
  friends: "var(--color-violet)", report: "var(--color-yellow)", motivation: "var(--color-tangerine)",
} as const;

export const accessibleAccentText = {
  light: { mint: "#005B40", violet: "#0B0030", pink: "#5D002D", yellow: "#725200", tangerine: "#4A1900", aqua: "#005267", danger: "#570000", focus: "#0B0030" },
  dark: { mint: "#55F2BC", violet: "#B3A2FF", pink: "#FF8FC1", yellow: "#FFE483", tangerine: "#FFB17C", aqua: "#83E9FF", danger: "#FF9A9D", focus: "#B3A2FF" },
  "high-contrast": { mint: "#006B49", violet: "#381CC6", pink: "#A0004B", yellow: "#624300", tangerine: "#843300", aqua: "#004F68", danger: "#A00000", focus: "#0000FF" },
} as const;
