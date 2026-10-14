import type { FeedResponse, Video } from "./types.ts";
import { decodeCursor, encodeCursor, nextQueryIndex, type CursorState } from "./cursor.ts";
import { curate, planQueries } from "./curator.ts";
import { getLanguage, type LangCode } from "./languages.ts";
import { matchSeedTopic, seedSuggestions, seedVideos } from "./seed.ts";
import { normalize } from "./text.ts";
import { searchShorts } from "./youtube.ts";

/** Al massimo 2 ricerche (200 unità di quota) per ogni pagina di feed. */
const MAX_SEARCHES_PER_PAGE = 2;
/** Se dopo una ricerca abbiamo almeno questi video, ci fermiamo lì. */
const TARGET_ITEMS = 6;

export async function liveFeed(
  apiKey: string,
  topic: string,
  lang: LangCode,
  rawCursor?: string,
): Promise<Pick<FeedResponse, "items" | "cursor">> {
  const decoded = rawCursor ? decodeCursor(rawCursor) : null;
  const state: CursorState = decoded ?? { q: [topic], i: 0, t: {} };
  // Alla prima pagina partiamo subito con la ricerca "secca" e intanto
  // pianifichiamo le altre ricerche (con l'AI, se attiva).
  let plan: Promise<string[]> | null = decoded ? null : planQueries(topic, lang);

  const items: Video[] = [];
  const seen = new Set<string>();
  for (let searches = 0; searches < MAX_SEARCHES_PER_PAGE && items.length < TARGET_ITEMS; searches++) {
    const k = nextQueryIndex(state);
    if (k === -1) break;
    const page = await searchShorts(apiKey, state.q[k], lang, state.t[k] ?? undefined);
    state.t[k] = page.nextPageToken;
    state.i = k + 1;

    if (plan) {
      state.q = mergeQueries(state.q, await plan);
      plan = null;
    }

    const fresh = page.candidates.filter((c) => !seen.has(c.id));
    fresh.forEach((c) => seen.add(c.id));
    items.push(...(await curate(topic, lang, fresh)));
  }
  if (plan) state.q = mergeQueries(state.q, await plan);

  return { items, cursor: nextQueryIndex(state) === -1 ? null : encodeCursor(state) };
}

export function mergeQueries(current: string[], planned: string[]): string[] {
  const out = [...current];
  const known = new Set(current.map(normalize));
  for (const q of planned) {
    const n = normalize(q);
    if (!n || known.has(n)) continue;
    known.add(n);
    out.push(q);
  }
  return out.slice(0, 8);
}

export function demoFeed(topic: string, lang: LangCode): FeedResponse {
  const seed = matchSeedTopic(topic);
  if (!seed) {
    return {
      topic,
      lang,
      mode: "demo",
      items: [],
      cursor: null,
      notice:
        "This is the demo, so only a few ready-made topics are available. " +
        "Full search for any topic is coming very soon.",
      suggestions: seedSuggestions().map(({ topic, lang }) => ({ topic, lang })),
    };
  }
  const notice =
    lang !== "any" && seed.lang !== lang
      ? `In the demo, ${seed.label} is only available in ${getLanguage(seed.lang).english}.`
      : undefined;
  return { topic: seed.label, lang: seed.lang, mode: "demo", items: seedVideos(seed), cursor: null, notice };
}
