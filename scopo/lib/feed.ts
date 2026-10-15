import { decodeCursor, encodeCursor, nextQueryIndex, type CursorState } from "./cursor.ts";
import { curate } from "./curator.ts";
import type { LangCode } from "./languages.ts";
import type { StepResponse } from "./paths.ts";
import type { Video } from "./types.ts";
import { searchShorts } from "./youtube.ts";

/** Al massimo 2 ricerche (200 unità di quota) per ogni richiesta. */
const MAX_SEARCHES = 2;
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

  const items: Video[] = [];
  const seen = new Set<string>();
  for (let searches = 0; searches < MAX_SEARCHES && items.length < VIDEOS_PER_STEP; searches++) {
    const k = nextQueryIndex(state);
    if (k === -1) break;
    const page = await searchShorts(apiKey, state.q[k], input.lang, state.t[k] ?? undefined);
    state.t[k] = page.nextPageToken;
    state.i = k + 1;

    const fresh = page.candidates.filter((c) => !seen.has(c.id));
    fresh.forEach((c) => seen.add(c.id));
    items.push(...(await curate(input.topic, input.step, input.lang, fresh)));
  }

  return {
    items: items.slice(0, VIDEOS_PER_STEP),
    cursor: nextQueryIndex(state) === -1 ? null : encodeCursor(state),
  };
}
