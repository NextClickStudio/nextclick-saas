import { decodeCursor, encodeCursor, nextQueryIndex, type CursorState } from "./cursor.ts";
import { curate } from "./curator.ts";
import type { LangCode } from "./languages.ts";
import type { StepResponse } from "./paths.ts";
import { searchShorts, type Candidate } from "./youtube.ts";

/** Al massimo 2 ricerche (200 unità di quota) per ogni richiesta. */
const MAX_SEARCHES = 2;
/** Con meno candidati di così si fa un'altra ricerca prima di scegliere. */
const MIN_CANDIDATES = 12;
export const VIDEOS_PER_STEP = 5;

/**
 * Video per un passo del percorso. Il server non tiene stato: le ricerche
 * del passo e i token di pagina viaggiano nel cursore.
 */
export async function fetchStepVideos(
  apiKey: string,
  input: { topic: string; step: string; queries: string[]; lang: LangCode; cursor?: string },
): Promise<StepResponse> {
  const decoded = input.cursor ? decodeCursor(input.cursor) : null;
  const state: CursorState = decoded ?? { q: input.queries.slice(0, 3), i: 0, t: {} };

  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (let searches = 0; searches < MAX_SEARCHES && candidates.length < MIN_CANDIDATES; searches++) {
    const k = nextQueryIndex(state);
    if (k === -1) break;
    const page = await searchShorts(apiKey, state.q[k], input.lang, state.t[k] ?? undefined);
    state.t[k] = page.nextPageToken;
    state.i = k + 1;

    for (const c of page.candidates) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      candidates.push(c);
    }
  }

  // Una sola chiamata all'AI per tutti i candidati del passo.
  const items = await curate(input.topic, input.step, input.lang, candidates);

  return {
    items: items.slice(0, VIDEOS_PER_STEP),
    cursor: nextQueryIndex(state) === -1 ? null : encodeCursor(state),
  };
}
