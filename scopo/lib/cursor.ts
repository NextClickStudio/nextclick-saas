/**
 * Il server non tiene stato: tutto quello che serve per la pagina successiva
 * (ricerche pianificate, a che punto siamo con ognuna) viaggia nel cursore.
 */
export type CursorState = {
  /** Ricerche da fare su YouTube, a rotazione, per tenere il feed vario. */
  q: string[];
  /** Prossima ricerca da usare. */
  i: number;
  /** Token di pagina per ricerca: assente = mai usata, null = finita. */
  t: Record<string, string | null>;
};

export function encodeCursor(state: CursorState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): CursorState | null {
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<CursorState>;
    if (
      !Array.isArray(v.q) ||
      v.q.length === 0 ||
      v.q.length > 10 ||
      !v.q.every((q) => typeof q === "string" && q.length > 0 && q.length <= 120) ||
      typeof v.i !== "number" ||
      !Number.isInteger(v.i) ||
      typeof v.t !== "object" ||
      v.t === null
    ) {
      return null;
    }
    const t: Record<string, string | null> = {};
    for (const [k, tok] of Object.entries(v.t)) {
      if (tok === null || typeof tok === "string") t[k] = tok;
    }
    return { q: v.q, i: v.i, t };
  } catch {
    return null;
  }
}

/** Indice della prossima ricerca non ancora esaurita, partendo da state.i; -1 se finite. */
export function nextQueryIndex(state: CursorState): number {
  const n = state.q.length;
  for (let step = 0; step < n; step++) {
    const k = (((state.i + step) % n) + n) % n;
    if (state.t[k] !== null) return k;
  }
  return -1;
}
