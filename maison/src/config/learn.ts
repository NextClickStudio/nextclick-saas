/**
 * MAISON — learning configuration. The server awards XP with the same numbers
 * (see supabase/migrations/*_maison_learn.sql).
 */
export const LEARN_CONFIG = {
  /** Lives per lesson run; one is lost per wrong answer. They refill over time. */
  hearts: { max: 5, refillMinutes: 15 },
  /** XP: a lesson gives 10 (5 on a same-day replay), +5 when perfect. Duels: win 20, lose 5. */
  xp: { lesson: 10, replay: 5, perfect: 5, duelWin: 20, duelLoss: 5 },
  /** Daily goal in XP. */
  dailyGoal: 30,
  /** Questions in a duel, and seconds per question. */
  duel: { questions: 7, secondsPerQuestion: 20 },
  /** Leagues by total XP. */
  leagues: [
    { name: "Bronze", from: 0, color: "#b87333" },
    { name: "Silver", from: 150, color: "#b9bcc1" },
    { name: "Gold", from: 400, color: "#d4ad55" },
    { name: "Sapphire", from: 900, color: "#1f3fa3" },
    { name: "Ruby", from: 1600, color: "#a3172c" },
    { name: "Emerald", from: 2600, color: "#0e6a4d" },
    { name: "Haute Couture", from: 4000, color: "#f2eee6" },
  ],
} as const;

export function leagueOf(xp: number) {
  const list = LEARN_CONFIG.leagues;
  let i = 0;
  while (i + 1 < list.length && xp >= list[i + 1].from) i++;
  return { ...list[i], index: i, next: list[i + 1] ?? null };
}
