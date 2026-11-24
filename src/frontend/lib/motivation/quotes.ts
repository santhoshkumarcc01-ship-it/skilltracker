export type MotivationQuote = { quote: string; author: string };

export const MOTIVATION_QUOTES: MotivationQuote[] = [
  { quote: "Small steps still move you forward.", author: "HabitHop" },
  { quote: "You can begin again as many times as you need.", author: "HabitHop" },
  { quote: "Progress grows where patience is planted.", author: "HabitHop" },
  { quote: "Make a little room for the things that matter.", author: "HabitHop" },
  { quote: "A kind promise to yourself is worth keeping.", author: "HabitHop" },
  { quote: "Curiosity is a lovely place to start.", author: "HabitHop" },
  { quote: "Your pace is allowed to be your own.", author: "HabitHop" },
  { quote: "One thoughtful moment can change the shape of a day.", author: "HabitHop" },
  { quote: "Rest is part of the rhythm, too.", author: "HabitHop" },
  { quote: "Keep the next step small enough to take.", author: "HabitHop" },
  { quote: "Every page starts with a first line.", author: "HabitHop" },
  { quote: "Showing up gently is still showing up.", author: "HabitHop" },
  { quote: "Let today be practice, not a performance.", author: "HabitHop" },
  { quote: "A little consistency can make a big garden.", author: "HabitHop" },
  { quote: "You are allowed to celebrate the in-between.", author: "HabitHop" },
  { quote: "Choose the next useful thing, then breathe.", author: "HabitHop" },
];

export function quoteOfTheDay(date = new Date()): MotivationQuote {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const index = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0) % MOTIVATION_QUOTES.length;
  return MOTIVATION_QUOTES[index]!;
}

