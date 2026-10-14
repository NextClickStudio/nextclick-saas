import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Candidate } from "./youtube.ts";
import type { Video } from "./types.ts";
import { keywords, looksLikeBait, normalize } from "./text.ts";

/**
 * La curatela decide due cose:
 * 1. quali ricerche fare su YouTube per coprire bene l'argomento;
 * 2. quali risultati tenere (solo in tema, informativi, niente risse o clickbait).
 *
 * Con ANTHROPIC_API_KEY lo fa Claude; senza, usa regole semplici.
 */

const MODEL = "claude-opus-5-5";

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client === undefined) {
    client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ timeout: 25_000, maxRetries: 1 })
      : null;
  }
  return client;
}

export function aiEnabled(): boolean {
  return getClient() !== null;
}

// ---------------------------------------------------------------- query plan

export function heuristicQueries(topic: string): string[] {
  const t = topic.trim();
  return [t, `${t} spiegato semplice`, `${t} in 1 minuto`, `${t} #shorts`, `${t} curiosità`];
}

const PlanSchema = z.object({
  queries: z.array(z.string()),
});

export async function planQueries(topic: string): Promise<string[]> {
  const ai = getClient();
  if (!ai) return heuristicQueries(topic);
  try {
    const res = await ai.beta.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(PlanSchema) },
      messages: [
        {
          role: "user",
          content:
            `Una persona vuole un feed di video brevi (YouTube Shorts) per imparare questo argomento: "${topic}".\n\n` +
            "Scrivi 6 ricerche da fare su YouTube, come le scriverebbe una persona nella barra di ricerca. " +
            "Ogni ricerca deve coprire un aspetto diverso dell'argomento (concetti base, come funziona, " +
            "storia, attualità spiegata, curiosità, errori comuni...), così il feed resta vario ma sempre in tema. " +
            "Punta a contenuti che spiegano e informano: evita parole che attirano risse, gossip o clickbait. " +
            "Scrivi le ricerche nella lingua dell'argomento (di solito italiano).",
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return heuristicQueries(topic);
    const planned = res.parsed_output.queries.map((q) => q.trim()).filter(Boolean).slice(0, 6);
    return planned.length > 0 ? planned : heuristicQueries(topic);
  } catch (err) {
    logAiError("planQueries", err);
    return heuristicQueries(topic);
  }
}

// ---------------------------------------------------------------- filtering

/** Senza AI: via i titoli da rissa/clickbait, prima i video che nominano l'argomento. */
export function heuristicCurate(topic: string, candidates: Candidate[]): Video[] {
  const words = keywords(topic);
  const scored = candidates
    .filter((c) => !looksLikeBait(c.title))
    .map((c, index) => {
      const text = normalize(`${c.title} ${c.description}`);
      const hits = words.filter((w) => text.includes(w)).length;
      return { c, index, hits };
    });
  // Ordine stabile: prima chi nomina più parole dell'argomento, poi l'ordine di YouTube.
  scored.sort((a, b) => b.hits - a.hits || a.index - b.index);
  return scored.map(({ c }) => toVideo(c));
}

const CurateSchema = z.object({
  keep: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
    }),
  ),
});

export async function curate(topic: string, candidates: Candidate[]): Promise<Video[]> {
  const ai = getClient();
  if (!ai || candidates.length === 0) return heuristicCurate(topic, candidates);

  const list = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    channel: c.channel,
    description: c.description,
  }));

  try {
    const res = await ai.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(CurateSchema) },
      messages: [
        {
          role: "user",
          content:
            `Stai curando un feed di video brevi per chi vuole imparare: "${topic}".\n\n` +
            "Tieni SOLO i video che:\n" +
            "- parlano davvero di questo argomento (non di temi vicini o generici);\n" +
            "- spiegano, insegnano o danno contesto (anche notizie, se spiegate).\n\n" +
            "Scarta: risse e litigi in TV, insulti, video fatti per far arrabbiare, gossip, meme, " +
            "titoli acchiappa-click o fuorvianti, promesse di guadagni facili, pubblicità, video fuori tema.\n\n" +
            "Metti per primi i video migliori. Per ognuno scrivi in `reason` cosa si impara, " +
            "in italiano, massimo 70 caratteri, senza iniziare con \"Perché\".\n\n" +
            `Video candidati (JSON):\n${JSON.stringify(list)}`,
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return heuristicCurate(topic, candidates);

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const kept: Video[] = [];
    for (const { id, reason } of res.parsed_output.keep) {
      const c = byId.get(id);
      if (!c) continue; // id inventato o duplicato
      byId.delete(id);
      kept.push({ ...toVideo(c), reason: reason.slice(0, 90) });
    }
    return kept;
  } catch (err) {
    logAiError("curate", err);
    return heuristicCurate(topic, candidates);
  }
}

function toVideo(c: Candidate): Video {
  const { description: _description, ...video } = c;
  return video;
}

function logAiError(where: string, err: unknown) {
  if (err instanceof Anthropic.RateLimitError) {
    console.warn(`[curator:${where}] rate limit, uso le regole semplici`);
  } else if (err instanceof Anthropic.APIError) {
    console.warn(`[curator:${where}] errore API ${err.status}: ${err.message}`);
  } else {
    console.warn(`[curator:${where}]`, err);
  }
}
