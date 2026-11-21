import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        mint: "var(--color-mint)",
        "mint-shadow": "var(--color-mint-shadow)",
        violet: "var(--color-violet)",
        "violet-shadow": "var(--color-violet-shadow)",
        pink: "var(--color-pink)",
        yellow: "var(--color-yellow)",
        tangerine: "var(--color-tangerine)",
        aqua: "var(--color-aqua)",
        danger: "var(--color-danger)",
        "surface-1": "var(--color-surface-1)",
        "surface-2": "var(--color-surface-2)",
        muted: "var(--color-muted)",
        primary: "var(--color-primary)",
        "primary-shadow": "var(--color-primary-shadow)",
        sky: "var(--color-sky)",
        sun: "var(--color-sun)",
        coral: "var(--color-coral)",
        purple: "var(--color-purple)",
        orange: "var(--color-orange)",
        "primary-foreground": "var(--color-primary-foreground)",
        "sky-foreground": "var(--color-sky-foreground)",
        "sun-foreground": "var(--color-sun-foreground)",
        "coral-foreground": "var(--color-coral-foreground)",
        "purple-foreground": "var(--color-purple-foreground)",
        "orange-foreground": "var(--color-orange-foreground)",
        ink: "var(--color-ink)",
        canvas: "var(--color-background)",
        card: "var(--color-card)",
        border: "var(--color-border)",
      },
      fontFamily: {
        heading: ["var(--font-fredoka)", "ui-rounded", "sans-serif"],
        sans: ["var(--font-nunito)", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        pop: "0 5px 0 var(--color-primary-shadow)",
        card: "0 4px 0 var(--color-border)",
        mint: "0 0 24px rgb(var(--color-success-glow) / 28%)",
        violet: "0 0 24px rgb(124 92 255 / 28%)",
        pink: "0 0 24px rgb(255 77 157 / 28%)",
        aqua: "0 0 24px rgb(40 215 255 / 28%)",
        tangerine: "0 0 24px rgb(255 138 61 / 28%)",
      },
      backgroundImage: { aurora: "var(--color-aurora)", sunset: "var(--color-sunset)", candy: "var(--color-candy)", "streak-fire": "var(--color-streak-fire)" },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        shine: { "0%": { transform: "translateX(-120%)" }, "100%": { transform: "translateX(240%)" } },
      },
      animation: { shine: "shine 1.8s ease-in-out infinite" },
    },
  },
  plugins: [],
};

export default config;
