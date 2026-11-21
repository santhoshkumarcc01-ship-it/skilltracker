import { describe, expect, it } from "vitest";
import { accessibleAccentText, themeColors } from "@/lib/theme";

function luminance(hex: string) {
  const value = hex.replace("#", "");
  const rgb = value.length === 3 ? [...value].map((channel) => Number.parseInt(channel + channel, 16)) : [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const linear = rgb.map((channel) => { const normalized = channel! / 255; return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("Aurora Arcade text contrast tokens", () => {
  it("keeps light-theme accent text at WCAG AA on each accent surface", () => {
    const pairs = [
      [accessibleAccentText.light.mint, themeColors.mint], [accessibleAccentText.light.violet, themeColors.violet],
      [accessibleAccentText.light.pink, themeColors.pink], [accessibleAccentText.light.yellow, themeColors.yellow],
      [accessibleAccentText.light.tangerine, themeColors.tangerine], [accessibleAccentText.light.aqua, themeColors.aqua],
      [accessibleAccentText.light.danger, themeColors.danger],
    ];
    for (const [foreground, background] of pairs) expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dark-theme accent text at WCAG AA on the dark card surface", () => {
    for (const foreground of Object.values(accessibleAccentText.dark)) expect(contrast(foreground, themeColors.darkSurface1)).toBeGreaterThanOrEqual(4.5);
  });
});
