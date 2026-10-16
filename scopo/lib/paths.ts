import type { LangCode } from "./languages.ts";
import type { Video } from "./types.ts";
import { normalize, stem } from "./text.ts";

/**
 * Un percorso è una sequenza ordinata di passi, dalle basi all'avanzato.
 * Ogni passo ha 2–5 video brevi; si parte dal primo passo che non conosci.
 */

export type Level = "new" | "basics" | "intermediate" | "advanced";

export const LEVELS: Array<{ id: Level; emoji: string; title: string; hint: string; fraction: number }> = [
  { id: "new", emoji: "🌱", title: "Brand new", hint: "Never really tried it", fraction: 0 },
  { id: "basics", emoji: "🙂", title: "I know the basics", hint: "Tried it a few times", fraction: 0.25 },
  { id: "intermediate", emoji: "💪", title: "Intermediate", hint: "Comfortable, want more", fraction: 0.5 },
  { id: "advanced", emoji: "🔥", title: "Advanced", hint: "Just fill the gaps", fraction: 0.75 },
];

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && LEVELS.some((l) => l.id === v);
}

export type PlanStep = {
  title: string;
  summary: string;
  /** Ricerche YouTube per trovare i video di questo passo, nella lingua scelta. */
  queries: string[];
  /** Parole che, se le scrivi in "cosa sai già", indicano che questo passo lo conosci. */
  keywords?: string[];
  /** Solo nella demo: i video sono già scelti a mano. */
  videos?: Video[];
};

export type PathPlan = {
  topic: string;
  title: string;
  emoji: string;
  lang: LangCode;
  /** demo = video scelti a mano; ai = percorso disegnato da Claude; template = passi generici. */
  mode: "demo" | "ai" | "template";
  steps: PlanStep[];
  startIndex: number;
  startReason: string;
  notice?: string;
};

export type PlanResponse =
  | { plan: PathPlan }
  | { notice: string; suggestions: Array<{ topic: string; lang: LangCode; emoji: string }> };

export type StepResponse = { items: Video[]; cursor: string | null };

// ------------------------------------------------- "scan" di cosa sai già

/** Parole che rendono negativa una frase: "barre chords are hard", "non so fare l'ollie". */
const NEGATIVE =
  /\b(not|don t|dont|can t|cant|cannot|never|hard|harder|difficult|struggle|struggling|trouble|stuck|no|non|mai|difficile|fatica|nicht|kein|keine|schwer|pas|jamais|nao|nunca|dificil)\b/;

/** Frasi "positive" di quello che la persona dice di saper fare. */
export function positiveClauses(text: string): string[] {
  return text
    .split(/[.,;:!?\n]+|\b(?:but|ma|pero|però|aber|mais|mas|however)\b/i)
    .map((c) => normalize(c ?? ""))
    .filter((c) => c.length > 1 && !NEGATIVE.test(c));
}

/**
 * Da dove partire senza AI: il livello scelto dà un punto di partenza minimo;
 * se la persona nomina cose di un passo più avanti, si parte dopo quel passo
 * (il percorso è in ordine, quindi i passi prima si danno per conosciuti).
 */
export function startFromKnowledge(
  steps: Array<Pick<PlanStep, "title" | "keywords">>,
  level: Level,
  known: string,
): { startIndex: number; lastKnown: number } {
  if (steps.length === 0) return { startIndex: 0, lastKnown: -1 };
  const fraction = LEVELS.find((l) => l.id === level)?.fraction ?? 0;
  const levelStart = Math.floor(steps.length * fraction);
  const clauses = positiveClauses(known);
  let lastKnown = -1;
  steps.forEach((s, i) => {
    const words = (s.keywords ?? []).map(normalize).filter(Boolean);
    if (words.length && clauses.some((c) => words.some((w) => c.includes(stem(w))))) lastKnown = i;
  });
  const startIndex = Math.min(steps.length - 1, Math.max(levelStart, lastKnown + 1));
  return { startIndex, lastKnown };
}

export function startReason(
  steps: Array<Pick<PlanStep, "title">>,
  startIndex: number,
  level: Level,
  lastKnown: number,
): string {
  if (startIndex === 0) return "You start from the very first step, so nothing important is skipped.";
  if (lastKnown >= 0 && lastKnown < startIndex) {
    return `You already know ${steps[lastKnown].title.toLowerCase()}, so you start at step ${startIndex + 1}.`;
  }
  const label = LEVELS.find((l) => l.id === level)?.title ?? "your level";
  return `Based on your level (“${label}”), you start at step ${startIndex + 1}. Earlier steps stay one tap away.`;
}

/** Stima grossolana: circa un minuto per video, 4 video per passo se non li conosciamo ancora. */
export function estimateMinutes(steps: Array<{ videos?: Video[] }>): number {
  return steps.reduce((sum, s) => {
    const vids = s.videos;
    if (!vids || vids.length === 0) return sum + 4;
    return sum + vids.reduce((m, v) => m + (v.durationSec ? v.durationSec / 60 : 1), 0);
  }, 0);
}
