import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Candidate } from "./youtube.ts";
import type { Video } from "./types.ts";
import { getLanguage, type LangCode } from "./languages.ts";
import { keywordHits, looksLikeBait, topicKeywords } from "./text.ts";

/**
 * La curatela decide due cose:
 * 1. quali ricerche fare su YouTube per coprire bene l'argomento, nella lingua scelta;
 * 2. quali risultati tenere: solo in tema, utili, nella lingua giusta, niente risse o clickbait.
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

function languageClause(lang: LangCode): string {
  return lang === "any"
    ? "in any language (prefer the language that gives the best results, usually English)"
    : `in ${getLanguage(lang).english}`;
}

// ---------------------------------------------------------------- query plan

export function heuristicQueries(topic: string, lang: LangCode): string[] {
  const t = topic.trim();
  return getLanguage(lang).templates.map((tpl) => tpl.replace("{t}", t));
}

const PlanSchema = z.object({
  queries: z.array(z.string()),
});

export async function planQueries(topic: string, lang: LangCode): Promise<string[]> {
  const ai = getClient();
  if (!ai) return heuristicQueries(topic, lang);
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
            `Someone wants a feed of short videos (YouTube Shorts) to learn: "${topic}". ` +
            `The videos must be ${languageClause(lang)}.\n\n` +
            "Write 6 YouTube search queries the way a person would type them in the search bar, " +
            `written ${languageClause(lang)} (translate the topic if needed). ` +
            "Each query should target a different, specific part of the topic (for example, for snowboarding: " +
            "ollie tutorial, carving tips, how to land a 180, beginner falls), so the feed stays varied " +
            "but every result is unmistakably about the topic. Avoid words that attract drama, fights or clickbait.",
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return heuristicQueries(topic, lang);
    const planned = res.parsed_output.queries.map((q) => q.trim()).filter(Boolean).slice(0, 6);
    return planned.length > 0 ? planned : heuristicQueries(topic, lang);
  } catch (err) {
    logAiError("planQueries", err);
    return heuristicQueries(topic, lang);
  }
}

// ---------------------------------------------------------------- filtering

/**
 * Senza AI: via i titoli da rissa/clickbait e via tutto quello che non nomina
 * l'argomento nel titolo, nella descrizione o nei tag. Prima i più pertinenti.
 */
export function heuristicCurate(topic: string, candidates: Candidate[]): Video[] {
  const words = topicKeywords(topic);
  const scored = candidates
    .filter((c) => !looksLikeBait(c.title))
    .map((c, index) => ({
      c,
      index,
      hits: keywordHits(words, `${c.title} ${c.description} ${c.tags.join(" ")}`),
    }))
    .filter(({ hits }) => words.length === 0 || hits > 0);
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

export async function curate(topic: string, lang: LangCode, candidates: Candidate[]): Promise<Video[]> {
  const ai = getClient();
  if (!ai || candidates.length === 0) return heuristicCurate(topic, candidates);

  const list = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    channel: c.channel,
    description: c.description,
    tags: c.tags,
    declaredLanguage: c.language ?? null,
  }));

  const languageRule =
    lang === "any"
      ? ""
      : `- are in ${getLanguage(lang).english} (judge from the title and description; drop videos clearly in another language);\n`;

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
            `You are curating a "learn by scrolling" feed for someone who searched: "${topic}".\n\n` +
            "Keep ONLY videos that:\n" +
            `- are clearly and specifically about "${topic}": someone who searched it would say "yes, exactly this" ` +
            "(for snowboarding: tricks, technique, gear tips; not skiing, not generic travel vlogs);\n" +
            "- teach something, show a technique, explain, or give useful context;\n" +
            languageRule +
            "\nDrop: drama, fights, rage-bait, gossip, pranks, memes with nothing to learn, misleading clickbait, " +
            "get-rich-quick promises, ads and promos, compilations with no explanation, anything off-topic.\n\n" +
            "Put the best videos first. For each one, write in `reason` what the viewer learns, " +
            'in English, at most 70 characters, not starting with "Why".\n\n' +
            `Candidate videos (JSON):\n${JSON.stringify(list)}`,
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
  const { description: _description, tags: _tags, language: _language, ...video } = c;
  return video;
}

function logAiError(where: string, err: unknown) {
  if (err instanceof Anthropic.RateLimitError) {
    console.warn(`[curator:${where}] rate limited, falling back to simple rules`);
  } else if (err instanceof Anthropic.APIError) {
    console.warn(`[curator:${where}] API error ${err.status}: ${err.message}`);
  } else {
    console.warn(`[curator:${where}]`, err);
  }
}
