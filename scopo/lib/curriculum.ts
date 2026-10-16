import { z } from "zod";
import { aiEnabled, languageClause } from "./curator.ts";
import { generateJson, logAiError, type GeminiSchema } from "./gemini.ts";
import { getLanguage, type LangCode } from "./languages.ts";
import {
  LEVELS,
  startFromKnowledge,
  startReason,
  type Level,
  type PathPlan,
  type PlanResponse,
  type PlanStep,
} from "./paths.ts";
import { matchSeedTopic, seedSteps, seedSuggestions } from "./seed.ts";

/**
 * Costruisce il percorso:
 * - senza YOUTUBE_API_KEY → percorsi demo con video scelti a mano;
 * - con una chiave Gemini → l'AI disegna i passi e legge "cosa sai già";
 * - altrimenti → passi generici (dalle basi all'avanzato) per qualsiasi argomento.
 */

export type PlanInput = { topic: string; lang: LangCode; level: Level; known: string };

export async function buildPlan(input: PlanInput): Promise<PlanResponse> {
  if (!process.env.YOUTUBE_API_KEY) return demoPlan(input);
  const ai = await aiPlan(input);
  return { plan: ai ?? templatePlan(input) };
}

// ------------------------------------------------------------------- demo

export function demoPlan({ topic, lang, level, known }: PlanInput): PlanResponse {
  const seed = matchSeedTopic(topic);
  if (!seed) {
    return {
      notice:
        "This is the demo, so only a few ready-made paths are available. " +
        "Paths for any topic are switching on very soon.",
      suggestions: seedSuggestions(),
    };
  }
  const steps = seedSteps(seed);
  const { startIndex, lastKnown } = startFromKnowledge(steps, level, known);
  return {
    plan: {
      topic: seed.label,
      title: seed.label,
      emoji: seed.emoji,
      lang: seed.lang,
      mode: "demo",
      steps,
      startIndex,
      startReason: startReason(steps, startIndex, level, lastKnown),
      notice:
        lang !== "any" && seed.lang !== lang
          ? `In the demo, this path is only available in ${getLanguage(seed.lang).english}.`
          : undefined,
    },
  };
}

// --------------------------------------------------------------- template

type Localized = Record<Exclude<LangCode, "any">, string>;

const TEMPLATE_STEPS: Array<{ title: string; summary: string; q: Localized }> = [
  {
    title: "Start from zero",
    summary: "What it is and your very first moves",
    q: { en: "{t} for absolute beginners", it: "{t} per principianti", es: "{t} para principiantes", fr: "{t} pour débutants", de: "{t} für Anfänger", pt: "{t} para iniciantes" },
  },
  {
    title: "The fundamentals",
    summary: "The core basics everything else builds on",
    q: { en: "{t} basics explained", it: "{t} le basi", es: "{t} lo básico", fr: "{t} les bases", de: "{t} Grundlagen", pt: "{t} o básico" },
  },
  {
    title: "Your first real skills",
    summary: "The first techniques worth practising",
    q: { en: "{t} first lesson", it: "{t} prima lezione", es: "{t} primera clase", fr: "{t} premier cours", de: "{t} erste Lektion", pt: "{t} primeira aula" },
  },
  {
    title: "Avoid common mistakes",
    summary: "What most people get wrong early on",
    q: { en: "{t} common mistakes", it: "{t} errori comuni", es: "{t} errores comunes", fr: "{t} erreurs courantes", de: "{t} häufige Fehler", pt: "{t} erros comuns" },
  },
  {
    title: "Build a practice routine",
    summary: "How to keep improving week after week",
    q: { en: "{t} practice routine", it: "{t} come esercitarsi", es: "{t} cómo practicar", fr: "{t} comment s'entraîner", de: "{t} richtig üben", pt: "{t} como praticar" },
  },
  {
    title: "Level up",
    summary: "Techniques for when the basics feel easy",
    q: { en: "{t} intermediate tips", it: "{t} livello intermedio", es: "{t} nivel intermedio", fr: "{t} niveau intermédiaire", de: "{t} Tipps für Fortgeschrittene", pt: "{t} nível intermediário" },
  },
  {
    title: "Pro tips",
    summary: "Advanced details that make the difference",
    q: { en: "{t} advanced tips", it: "{t} consigli avanzati", es: "{t} consejos avanzados", fr: "{t} conseils avancés", de: "{t} Profi Tipps", pt: "{t} dicas avançadas" },
  },
];

export function templatePlan({ topic, lang, level }: PlanInput): PathPlan {
  const t = topic.trim();
  const code = lang === "any" ? "en" : lang;
  const steps: PlanStep[] = TEMPLATE_STEPS.map((s) => ({
    title: s.title,
    summary: s.summary,
    queries: [s.q[code].replace("{t}", t)],
  }));
  const { startIndex } = startFromKnowledge(steps, level, "");
  return {
    topic: t,
    title: t.charAt(0).toUpperCase() + t.slice(1),
    emoji: "📚",
    lang,
    mode: "template",
    steps,
    startIndex,
    startReason: startReason(steps, startIndex, level, -1),
  };
}

// --------------------------------------------------------------------- AI

const CurriculumSchema = z.object({
  title: z.string(),
  emoji: z.string(),
  steps: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      query: z.string(),
    }),
  ),
  startIndex: z.number(),
  startReason: z.string(),
});

const CURRICULUM_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    emoji: { type: "STRING" },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, summary: { type: "STRING" }, query: { type: "STRING" } },
        required: ["title", "summary", "query"],
      },
    },
    startIndex: { type: "INTEGER" },
    startReason: { type: "STRING" },
  },
  required: ["title", "emoji", "steps", "startIndex", "startReason"],
};

export async function aiPlan({ topic, lang, level, known }: PlanInput): Promise<PathPlan | null> {
  if (!aiEnabled()) return null;
  const levelLabel = LEVELS.find((l) => l.id === level)?.title ?? "Brand new";
  const prompt =
    `Design a learning path for someone who wants to learn "${topic}" by watching short videos ` +
    "(YouTube Shorts, under 3 minutes each).\n\n" +
    "Create 6 to 10 steps, ordered from the absolute basics to advanced. Each step must be ONE concrete " +
    "skill or idea that 2 to 5 short videos can teach, and each step should build on the previous ones.\n" +
    "For each step write:\n" +
    "- title: at most 40 characters, in English;\n" +
    "- summary: at most 90 characters, in English, what the learner can do after this step;\n" +
    `- query: a YouTube search query written ${languageClause(lang)} that finds short videos for exactly ` +
    "this step. Include the topic name so the results stay on topic.\n\n" +
    `The learner describes their level as: ${levelLabel}.\n` +
    `In their own words, what they already know: ${known.trim() ? `"${known.trim()}"` : "(nothing written)"}\n\n` +
    "Set startIndex to the 0-based index of the first step they still need. Skip what they clearly already " +
    "know; when in doubt, start earlier.\n" +
    "Write startReason in English, second person, at most 110 characters: where they start and why.\n" +
    "Also give the path a short title (at most 40 characters, in English) and one emoji for the topic.";

  try {
    const { value: out } = await generateJson(prompt, CURRICULUM_SCHEMA, (v) => CurriculumSchema.parse(v), {
      timeoutMs: 45_000,
    });

    const steps: PlanStep[] = out.steps
      .filter((s) => s.title.trim() && s.query.trim())
      .slice(0, 10)
      .map((s) => ({
        title: s.title.trim().slice(0, 60),
        summary: s.summary.trim().slice(0, 120),
        queries: [s.query.trim().slice(0, 100)],
      }));
    if (steps.length < 3) return null;

    const startIndex = Math.min(steps.length - 1, Math.max(0, Math.round(out.startIndex)));
    return {
      topic: topic.trim(),
      title: out.title.trim().slice(0, 60) || topic.trim(),
      emoji: [...out.emoji.trim()].slice(0, 2).join("") || "📚",
      lang,
      mode: "ai",
      steps,
      startIndex,
      startReason: out.startReason.trim().slice(0, 160),
    };
  } catch (err) {
    logAiError("plan", err);
    return null;
  }
}
