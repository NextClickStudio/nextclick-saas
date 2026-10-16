/**
 * Punti, livelli e serie di giorni: una piccola ricompensa per ogni video
 * visto e per ogni passo completato. Tutto calcolato sul dispositivo.
 */

export const XP = { video: 10, step: 50, path: 200 } as const;

export type XpKind = keyof typeof XP;

export type Stats = {
  xp: number;
  /** Giorni consecutivi con almeno un video visto. */
  streak: number;
  best: number;
  /** Ultimo giorno attivo, "YYYY-MM-DD" nell'ora locale. */
  lastDay: string | null;
  videos: number;
  steps: number;
  paths: number;
};

export const EMPTY_STATS: Stats = { xp: 0, streak: 0, best: 0, lastDay: null, videos: 0, steps: 0, paths: 0 };

const TITLES = ["Rookie", "Curious", "Learner", "Grinder", "Focused", "Pro", "Beast", "Legend"];

export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function previousDay(day: string): string {
  // Mezzogiorno, così il cambio dell'ora legale non sposta il giorno.
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

/** Il livello n parte da 100·n·(n−1)/2 XP: 0, 100, 300, 600, 1000… */
export function levelFor(xp: number) {
  const level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / 100)) / 2));
  const start = (100 * level * (level - 1)) / 2;
  const span = 100 * level;
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    into: xp - start,
    span,
    ratio: Math.min(1, (xp - start) / span),
  };
}

/** Aggiunge i punti e aggiorna la serie: oggi conta una volta, saltare un giorno la azzera. */
export function award(stats: Stats, kind: XpKind, today: string): Stats {
  const streak = stats.lastDay === today ? stats.streak : stats.lastDay === previousDay(today) ? stats.streak + 1 : 1;
  return {
    ...stats,
    xp: stats.xp + XP[kind],
    streak,
    best: Math.max(stats.best, streak),
    lastDay: today,
    videos: stats.videos + (kind === "video" ? 1 : 0),
    steps: stats.steps + (kind === "step" ? 1 : 0),
    paths: stats.paths + (kind === "path" ? 1 : 0),
  };
}

/** La serie da mostrare: è ancora viva se l'ultimo giorno attivo è oggi o ieri. */
export function liveStreak(stats: Stats, today: string): number {
  return stats.lastDay === today || stats.lastDay === previousDay(today) ? stats.streak : 0;
}
