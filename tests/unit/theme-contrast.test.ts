import { describe, expect, it } from "vitest";
import { accessibleAccentText } from "@/lib/theme";

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("design system contrast tokens", () => {
  it("keeps text accents and focus indicators at WCAG AA on theme surfaces", () => {
    const accents = Object.entries(accessibleAccentText.light).filter(([name]) => name !== "focus");
    for (const [name, foreground] of accents) {
      expect(contrastRatio(foreground, "#F7F7FB"), `light ${name} on canvas`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(foreground, "#FFFFFF"), `light ${name} on card`).toBeGreaterThanOrEqual(4.5);
    }

    const darkSurfaces = ["#131F24", "#1D2C32"];
    const darkAccents = Object.entries(accessibleAccentText.dark).filter(([name]) => name !== "focus");
    for (const [name, foreground] of darkAccents) {
      for (const surface of darkSurfaces) expect(contrastRatio(foreground, surface), `dark ${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const surface of ["#F7F7FB", "#FFFFFF", ...darkSurfaces]) {
      const foreground = surface.startsWith("#F") ? accessibleAccentText.light.focus : accessibleAccentText.dark.focus;
      expect(contrastRatio(foreground, surface), `focus ring on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });
});
