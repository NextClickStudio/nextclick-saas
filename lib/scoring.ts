// Calcolo dei punteggi e delle posizioni in classifica.
// Funzioni "pure" (niente database): vedi tests/scoring.test.ts.

export type CriterionWeight = { id: string; weight: number };
export type CriterionScore = { criterion_id: string; score: number };

/**
 * Media ponderata dei punteggi (0-10) per il peso di ogni criterio,
 * riportata su scala 0-100 e arrotondata all'intero.
 * I criteri senza punteggio contano come 0.
 */
export function computeTotalScore(criteria: CriterionWeight[], scores: CriterionScore[]): number {
  const byId = new Map(scores.map((s) => [s.criterion_id, s.score]));
  let weighted = 0;
  let totalWeight = 0;
  for (const c of criteria) {
    const w = Math.max(0, c.weight);
    const s = Math.min(10, Math.max(0, byId.get(c.id) ?? 0));
    weighted += s * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Math.round((weighted / (totalWeight * 10)) * 100);
}

export type Ranked<T> = T & { position: number };

/**
 * Ordina per punteggio decrescente e assegna la posizione.
 * A pari punteggio la posizione è la stessa (1, 2, 2, 4...),
 * e l'ordine è alfabetico per nome.
 */
export function rankByScore<T extends { score: number; name: string }>(items: T[]): Ranked<T>[] {
  const sorted = [...items].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "it"));
  let lastScore: number | null = null;
  let lastPosition = 0;
  return sorted.map((item, i) => {
    const position = item.score === lastScore ? lastPosition : i + 1;
    lastScore = item.score;
    lastPosition = position;
    return { ...item, position };
  });
}

/** Media arrotondata all'intero (0 se la lista è vuota). */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
