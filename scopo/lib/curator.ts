import { z } from "zod";
import { generateJson, geminiKey, logAiError, type GeminiSchema } from "./gemini.ts";
import type { Candidate } from "./youtube.ts";
import type { Video } from "./types.ts";
import { getLanguage, type LangCode } from "./languages.ts";
import { keywordHits, looksLikeBait, topicKeywords } from "./text.ts";

/**
 * La curatela sceglie quali video tenere per un passo del percorso:
 * solo in tema, utili, nella lingua giusta, niente risse o clickbait.
 * Con una chiave Gemini lo fa l'AI; senza, usa regole semplici.
 */

export function aiEnabled(): boolean {
  return geminiKey() !== null;
}

export function languageClause(lang: LangCode): string {
  return lang === "any"
    ? "in any language (prefer the language that gives the best results, usually English)"
    : `in ${getLanguage(lang).english}`;
}

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

const CURATE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    keep: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { id: { type: "STRING" }, reason: { type: "STRING" } },
        required: ["id", "reason"],
      },
    },
  },
  required: ["keep"],
};

/**
 * `topic` è l'argomento del percorso, `focus` il passo (es. "Barre chords"):
 * teniamo solo i video che insegnano proprio quel passo.
 */
export async function curate(
  topic: string,
  focus: string,
  lang: LangCode,
  candidates: Candidate[],
): Promise<Video[]> {
  const subject = focus ? `${topic}: ${focus}` : topic;
  if (!aiEnabled() || candidates.length === 0) return heuristicCurate(subject, candidates);

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

  const prompt =
    `You are picking videos for one step of a learning path about "${topic}".\n` +
    (focus ? `This step is: "${focus}".\n\n` : "\n") +
    "Keep ONLY videos that:\n" +
    `- are clearly about ${focus ? `this step of ${topic}` : topic} (not a different skill, not a different sport or subject);\n` +
    "- teach something, show a technique, explain, or give useful context;\n" +
    languageRule +
    "\nDrop: drama, fights, rage-bait, gossip, pranks, memes with nothing to learn, misleading clickbait, " +
    "get-rich-quick promises, ads and promos, compilations with no explanation, anything off-topic.\n\n" +
    "Order them from the most beginner-friendly to the most advanced. For each one, write in `reason` " +
    'what the viewer learns, in English, at most 70 characters, not starting with "Why".\n\n' +
    `Candidate videos (JSON):\n${JSON.stringify(list)}`;

  try {
    const { value } = await generateJson(prompt, CURATE_SCHEMA, (v) => CurateSchema.parse(v), { timeoutMs: 30_000 });

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const kept: Video[] = [];
    for (const { id, reason } of value.keep) {
      const c = byId.get(id);
      if (!c) continue; // id inventato o duplicato
      byId.delete(id);
      kept.push({ ...toVideo(c), reason: reason.slice(0, 90) });
    }
    return kept;
  } catch (err) {
    logAiError("curate", err);
    return heuristicCurate(subject, candidates);
  }
}

function toVideo(c: Candidate): Video {
  const { description: _description, tags: _tags, language: _language, ...video } = c;
  return video;
}
