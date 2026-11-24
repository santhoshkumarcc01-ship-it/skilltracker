import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { QueryProvider } from "@/frontend/components/providers/QueryProvider";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: "HabitHop — little steps, big streaks",
  description: "A playful space to build daily habits, one hop at a time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${fredoka.variable} ${nunito.variable} font-sans antialiased`}><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}

