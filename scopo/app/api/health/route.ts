import { aiPlan } from "@/lib/curriculum";
import { fetchStepVideos } from "@/lib/feed";
import { GeminiError, generateJson, geminiKey } from "@/lib/gemini";
import { checkKey, YouTubeError } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/health → le chiavi sono configurate e funzionano?
 * Con ?deep=1 prova anche un percorso vero (circa 200 unità di quota YouTube
 * e 2 chiamate a Gemini). Il risultato resta in cache 10 minuti, così
 * chiamarlo spesso non consuma quota. Non mostra mai le chiavi.
 */

type Check = { configured: boolean; ok: boolean; detail: string };

type Report = {
  ok: boolean;
  youtube: Check;
  ai: Check & { provider: "gemini"; keyEnv: string | null; model: string | null };
  sample?: {
    plan: { title: string; mode: "ai" | "template"; start: number; steps: string[] } | null;
    step: { title: string; videos: Array<{ title: string; reason?: string }> } | null;
    planMs: number;
    stepMs: number;
  };
  checkedAt: string;
};

const TTL_MS = 10 * 60_000;
let cached: { at: number; deep: boolean; report: Report } | null = null;

function describe(err: unknown): string {
  if (err instanceof YouTubeError || err instanceof GeminiError) return err.message;
  return err instanceof Error ? err.message : "Unknown error";
}

async function checkYouTube(apiKey: string | undefined): Promise<Check> {
  if (!apiKey) return { configured: false, ok: false, detail: "YOUTUBE_API_KEY is not set" };
  try {
    await checkKey(apiKey);
    return { configured: true, ok: true, detail: "YouTube Data API key works" };
  } catch (err) {
    return { configured: true, ok: false, detail: describe(err) };
  }
}

async function checkGemini(): Promise<Report["ai"]> {
  const auth = geminiKey();
  if (!auth) {
    return { provider: "gemini", configured: false, ok: false, keyEnv: null, model: null, detail: "No Gemini key set" };
  }
  try {
    const { model } = await generateJson(
      'Reply with the JSON object {"ok":"yes"}.',
      { type: "OBJECT", properties: { ok: { type: "STRING" } }, required: ["ok"] },
      (v) => v,
      { timeoutMs: 20_000 },
    );
    return { provider: "gemini", configured: true, ok: true, keyEnv: auth.env, model, detail: "Gemini answers" };
  } catch (err) {
    return { provider: "gemini", configured: true, ok: false, keyEnv: auth.env, model: null, detail: describe(err) };
  }
}

async function samplePath(apiKey: string, useAi: boolean): Promise<NonNullable<Report["sample"]>> {
  const started = Date.now();
  const plan = useAi
    ? await aiPlan({ topic: "guitar", lang: "en", level: "basics", known: "I can play a few open chords" })
    : null;
  const planMs = Date.now() - started;
  const step = plan?.steps[plan.startIndex];
  const title = step?.title ?? "Barre chords";
  const res = await fetchStepVideos(apiKey, {
    topic: "guitar",
    step: title,
    queries: step?.queries ?? ["guitar barre chords for beginners"],
    lang: "en",
  });
  return {
    plan: plan
      ? { title: plan.title, mode: "ai", start: plan.startIndex, steps: plan.steps.map((s) => s.title) }
      : null,
    step: { title, videos: res.items.map((v) => ({ title: v.title, reason: v.reason })) },
    planMs,
    stepMs: Date.now() - started - planMs,
  };
}

export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  if (cached && Date.now() - cached.at < TTL_MS && (cached.deep || !deep)) {
    return Response.json({ ...cached.report, cached: true });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  const [youtube, ai] = await Promise.all([checkYouTube(apiKey), checkGemini()]);
  const report: Report = { ok: youtube.ok && ai.ok, youtube, ai, checkedAt: new Date().toISOString() };

  if (deep && apiKey && youtube.ok) {
    try {
      report.sample = await samplePath(apiKey, ai.ok);
    } catch (err) {
      report.ok = false;
      report.youtube = { ...youtube, ok: false, detail: `Sample search failed: ${describe(err)}` };
    }
  }

  cached = { at: Date.now(), deep, report };
  return Response.json(report);
}
